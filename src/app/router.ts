import { Vector } from './vector';
import * as jsgraphs from 'js-graph-algorithms';
import { BROADCAST_IP, OSPF_SIZE } from './constants';
import { Packet, PacketType } from './packet';
import { BaseDevice } from './base-device';
import { Device, Router, Link, Host, Interface, Route, isRouter, isHost } from './network-devices';

const BROADCAST_CACHE_INTERVAL = 60000; // 1min

export class RouterProvider extends BaseDevice implements Router {
  public isRouter: boolean = true;
  public lsdb: Link[] = [];
  private routingTable: Route[] = [];
  private fib: { [ip: string]: Link } = {};

  private cachedBroadcastPkt: Packet[] = [];

  constructor(public id: string, public label: string, public position: Vector) {
    super(id, label, position);

    this.position = {
      x: this.position.x - 22,
      y: this.position.y + 25
    };
  }

  public forwardPacket(packet: Packet): void {
    let link = this.fib[packet.dstIp];

    if (link) {
      link.sendPacketFrom(this, packet);
    } else {
      console.log(`Dropping packet at ${this.label} due to unreachable network`);
    }
  }

  public receivePacket(packet: Packet, link: Link): void {
    if (packet.type === PacketType.LinkUp) {
      let link = <Link>packet.payload;

      if (this.lsdb.indexOf(link) < 0) {
        this.lsdb.push(link);

        setTimeout(() => this.updateRoutingTable());
      }
    } else if (packet.type === PacketType.LinkDown) {
      let link = <Link>packet.payload;
      let idx = this.lsdb.indexOf(link);

      if (idx > 0) {
        this.lsdb.splice(idx, 1);
        setTimeout(() => this.updateRoutingTable());
      }
    } else if (packet.type === PacketType.LSA) {
      this.mergeLsdb(<Link[]>packet.payload);
      setTimeout(() => this.updateRoutingTable());
    }

    packet.ttl = packet.ttl - 1;

    if (packet.ttl <= 0) {
      return;
    }

    if (packet.dstIp === BROADCAST_IP) {
      this.broadcast(packet, [link]);
    } else {
      this.forwardPacket(packet);
    }
  }

  public broadcast(packet: Packet, exclude: Link[]): void {
    if (this.cachedBroadcastPkt.indexOf(packet) >= 0) {
      // This packet is already broadcast, a loop is detected

      return;
    }

    this.cachedBroadcastPkt.push(packet);

    setTimeout(() => {
      this.cachedBroadcastPkt = this.cachedBroadcastPkt.filter(_pkt => _pkt !== packet);
    }, BROADCAST_CACHE_INTERVAL);

    for (let intf of this.interfaces) {
      if (exclude.indexOf(intf.link) > 0) {
        continue;
      }

      intf.link.sendPacketFrom(this, packet);
    }
  }

  public attachLink(link: Link, ip: string): void {
    super.attachLink(link, ip);

    if (this.lsdb.indexOf(link) < 0) {
      this.lsdb.push(link);
    }

    this.advertiseNewLink(link);

    let otherEnd = link.getOtherEnd(this);

    if (isRouter(otherEnd)) {
      this.learnLsdb(otherEnd);
      this.advertiseLsdb(link);
    }

    setTimeout(() => {
      this.updateRoutingTable();
    });
  }

  public detachLink(link: Link): void {
    super.detachLink(link);

    let idx = this.lsdb.indexOf(link);

    if (idx >= 0) {
      this.lsdb.splice(idx, 1);
    }

    this.advertiseLinkRemoval(link);

    setTimeout(() => {
      this.updateRoutingTable();
    });
  }

  public learnLsdb(fromRouter: Router): void {
    this.mergeLsdb(fromRouter.lsdb);
  }

  public mergeLsdb(lsdb: Link[]): void {
    let uniqued = new Set([...this.lsdb, ...lsdb]);
    let merged: Link[] = [];

    uniqued.forEach(link => merged.push(link));

    this.lsdb = merged;
  }

  public advertiseNewLink(link: Link): void {
    let packet = new Packet('0', BROADCAST_IP, BROADCAST_IP, PacketType.LinkUp,
      0, OSPF_SIZE, link);

    this.broadcast(packet, [link]);
  }

  public advertiseLinkRemoval(link: Link): void {
    let packet = new Packet('0', BROADCAST_IP, BROADCAST_IP, PacketType.LinkDown,
      0, OSPF_SIZE, link);

    this.broadcast(packet, [link]);
  }

  public advertiseLsdb(link: Link): void {
    let packet = new Packet('0', BROADCAST_IP, BROADCAST_IP, PacketType.LSA, 0,
      OSPF_SIZE, this.lsdb);

    this.broadcast(packet, [link]);
  }

  public advertiseLsa(link: Link): void {
    let packet = new Packet('0', BROADCAST_IP, BROADCAST_IP, PacketType.LSA, 0,
      OSPF_SIZE, []);

    this.broadcast(packet, []);
  }

  public updateRoutingTable(): void {
    if (this.lsdb.length === 0) {
      return;
    }

    let knownHostList: Host[] = [];
    let idToIdx = {};
    let idxToDevice = {};
    let idxCounter = 0;

    for (let link of this.lsdb) {
      for (let node of [link.src, link.dst]) {
        if (idToIdx[node.id]) {
          continue;
        }

        if (isHost(node)) {
          knownHostList.push(node);
        }

        idToIdx[node.id] = idxCounter;
        idxToDevice[idxCounter] = node;
        idxCounter++;
      }
    }

    let graph = new jsgraphs.WeightedGraph(idxCounter);

    for (let link of this.lsdb) {
      let srcIdx = idToIdx[link.src.id];
      let dstIdx = idToIdx[link.dst.id];

      graph.addEdge(new jsgraphs.Edge(srcIdx, dstIdx, link.metric));
      graph.addEdge(new jsgraphs.Edge(dstIdx, srcIdx, link.metric));
    }

    let dijkstra = new jsgraphs.Dijkstra(graph, idToIdx[this.id]);
    let routingTable: Route[] = [];

    for (let host of knownHostList) {
      let idx = idToIdx[host.id];

      if (!dijkstra.hasPathTo(idx)) {
        continue;
      }

      let firstHop = dijkstra.pathTo(idToIdx[host.id])[0];
      let nextHop = idxToDevice[firstHop.to()];

      routingTable.push(new Route(host.getIp(), nextHop));
    }

    this.routingTable = routingTable;

    this.updateFib();
  }

  private updateFib(): void {
    let hopLinkMap: { [hopId: string]: Link } = {};
    let fib: { [ip: string]: Link } = {};

    for (let intf of this.interfaces) {
      let link = intf.link;

      hopLinkMap[link.getOtherEnd(this).id] = link;
    }

    for (let route of this.routingTable) {
      let link = hopLinkMap[route.nextHop.id];

      if (link) {
        fib[route.ip] = link;
      }
    }

    this.fib = fib;
  }
}
