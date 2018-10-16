import { Subject } from 'rxjs';
import { Vector } from './vector';
import * as jsgraphs from 'js-graph-algorithms';
import * as Deque from 'double-ended-queue';
import { TIME_SLOWDOWN, BROADCAST_IP, OSPF_SIZE, PKT_SIZE,
  HEADER_SIZE, PAYLOAD_SIZE, CTL_SIZE, RWND_INIT, SSTHRESH_INIT,
  BETA, IPv4, MEGA } from './constants';
import { v4 } from 'uuid';
import { SeriesPoint } from './series-point';

export class Device {
  public interfaces: Interface[] = [];

  private portCounter: number = 0;

  constructor(public id: string, public label: string, public position: Vector) {
  }

  public panBy(delta: Vector): void {
    this.position = {
      x: this.position.x + delta.x,
      y: this.position.y + delta.y
    };
  }

  public attachLink(link: Link, ip: string): void {
    this.portCounter++;
    this.interfaces.push(new Interface(this.portCounter, ip, link));
  }

  public detachLink(link: Link): void {
    this.interfaces = this.interfaces.filter(intf => intf.link !== link);
  }

  public receivePacket(packet: Packet, link: Link): void {}
}

export class Host extends Device {
  public isHost: boolean = true;
  public flowList: Flow[] = [];
  public receiveList: FlowReceived[] = [];
  public algorithm: string;
  public hasInvalidFormat: boolean = false;

  constructor(public id: string, public label: string, public position: Vector) {
    super(id, label, position);

    this.position = {
      x: this.position.x - 12,
      y: this.position.y + 25
    };
    this.algorithm = "Reno";

    this.flowList = [];
    this.receiveList = [];
  }

  addNewFlow(dest: string, data: number, startTime: number): void {
    if (IPv4.test(dest) && data > 0 && startTime >= 0) {
      let id = v4();
      this.flowList.push(new Flow(id, this, dest, data, startTime));
    } else{
      this.hasInvalidFormat = true;
    }
  }

  public getIp(): string {
    let gateway = this.interfaces[0];

    if (gateway) {
      return gateway.ip;
    } else {
      return 'N/A';
    }
  }

  public receivePacket(packet: Packet, link: Link): void {
    if (packet.type === PacketType.Payload) {
    }    
    if (packet.dstIp !== this.getIp()) {
      return;
    }

    let flowId = packet.getFlowId();

    if (packet.type === PacketType.Syn) {
      let flow = new FlowReceived(flowId);
      this.receiveList.push(flow);    // Construct the session
      let pkt = new Packet(flowId, this.getIp(), packet.srcIp, PacketType.SynAck, 0, CTL_SIZE);
      setTimeout(()=>this.sendPacket(pkt));
      return;
    }

    if (packet.type === PacketType.SynAck) {
      let flows = this.flowList.filter(r => r.flowId === flowId);
      if (flows.length > 0){
        let flow = flows[0];
        flow.onReceive(packet);
      }
      return;
    }

    if (packet.type === PacketType.Payload) {
      let flows = this.receiveList.filter(r => r.flowId === flowId);
      if (flows.length > 0) {
        let flow = flows[0];

        flow.onReceive(packet);
        let pkt = new Packet(flowId, this.getIp(), packet.srcIp, PacketType.Ack, flow.getAckSeqNum(), CTL_SIZE);
        setTimeout(()=>this.sendPacket(pkt));
      }
      return;
    }

    if (packet.type === PacketType.Ack) {
      let flows = this.flowList.filter(r => r.flowId === flowId);
      if (flows.length > 0) {
        let flow = flows[0];
        flow.onReceive(packet);
      }
      return;
    }

    // Send ack packet here
  }

  public sendPacket(packet: Packet): void {
    if (packet.type === PacketType.Payload) {
    }
    let gateway = this.interfaces[0];
    if (gateway) {
      gateway.link.sendPacketFrom(this, packet);
    } else {
      (`Dropping packet at ${this.label} due to missing gateway.`);
    }
  }
}

const BROADCAST_CACHE_INTERVAL = 60000; // 1min

export class Router extends Device {
  public isRouter: boolean = true;
  private lsdb: Link[] = [];
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

  public broadcast(packet: Packet, exclude: Link[]) {
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

    if (otherEnd instanceof Router) {
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
    let packet = new Packet(0, BROADCAST_IP, BROADCAST_IP, PacketType.LinkUp,
      0, OSPF_SIZE, link);

    this.broadcast(packet, [link]);
  }

  public advertiseLinkRemoval(link: Link): void {
    let packet = new Packet(0, BROADCAST_IP, BROADCAST_IP, PacketType.LinkDown,
      0, OSPF_SIZE, link);

    this.broadcast(packet, [link]);
  }

  public advertiseLsdb(link: Link): void {
    let packet = new Packet(0, BROADCAST_IP, BROADCAST_IP, PacketType.LSA, 0,
      OSPF_SIZE, this.lsdb);

    this.broadcast(packet, [link]);
  }

  public advertiseLsa(link: Link): void {
    let packet = new Packet(0, BROADCAST_IP, BROADCAST_IP, PacketType.LSA, 0,
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

        if (node instanceof Host) {
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

const DEFAULT_CAP = 10;
const DEFAULT_DELAY = 10;
const DEFAULT_LOSS_RATE = 0.1;
const DEFAULT_BUFFER_SIZE = 64;
const DEFAULT_METRIC = 100;
const BYTES_IN_KB = 1024;
const BYTES_PER_MBPS = 1024 * 1024 / 8;
const STATS_UPDATE_INTERVAL = 1000; // 1s
const MAX_STATS_LENGTH = 100;

export class Link {
  public isLink: boolean = true;
  public capacity: number = DEFAULT_CAP;
  public delay: number = DEFAULT_DELAY;
  public lossRate: number = DEFAULT_LOSS_RATE;
  public bufferSize: number = DEFAULT_BUFFER_SIZE;
  public metric: number = DEFAULT_METRIC;
  public latencyStats: SeriesPoint[][] = [];
  public lossRateStats: SeriesPoint[][] = [];
  public throughputStats: SeriesPoint[][] = [];

  private srcBuffer = new Deque();
  private dstBuffer = new Deque();
  private srcBufferUsed: number = 0;
  private dstBufferUsed: number = 0;

  private srcSending: boolean = false;
  private dstSending: boolean = false;

  private srcLatencyData: number[] = [];
  private srcLostPktCounter: number = 0;
  private srcSentPktCounter: number = 0;
  private srcThroughputCounter: number = 0;

  private srcLatencyStats: SeriesPoint[] = [];
  private srcLossRateStats: SeriesPoint[] = [];
  private srcThroughputStats: SeriesPoint[] = [];
  private srcLastUpdated: number;

  private dstLatencyData: number[] = [];
  private dstLostPktCounter: number = 0;
  private dstSentPktCounter: number = 0;
  private dstThroughputCounter: number = 0;

  private dstLatencyStats: SeriesPoint[] = [];
  private dstLossRateStats: SeriesPoint[] = [];
  private dstThroughputStats: SeriesPoint[] = [];
  private dstLastUpdated: number;

  private srcTransTimer: number;
  private dstTransTimer: number;
  private srcNextTimer: number;
  private dstNextTimer: number;
  private srcStatsTimer: number;
  private dstStatsTimer: number;

  constructor(public id: string, public src: Device, public dst: Device) {
    let now = Date.now();

    this.srcLastUpdated = now;
    this.dstLastUpdated = now;

    this.updateSrcStats();
    this.updateDstStats();
  }

  public getOtherEnd(element: Device): Device {
    if (element === this.src) {
      return this.dst;
    } else {
      return this.src;
    }
  }

  public getHostIfPresent(): (Host | void) {
    if (this.src instanceof Host) {
      return this.src;
    } else if (this.dst instanceof Host) {
      return this.dst;
    }
  }

  public sendPacketFrom(source: Device, packet: Packet): void {
    if (source === this.src) {
      let newSrcBufferSize = this.srcBufferUsed + packet.size;

      if (newSrcBufferSize > this.bufferSize * BYTES_IN_KB) {
        console.log(`Dropping packets at ${this.id} due to buffer overflow.`);

        return;
      }

      this.srcBuffer.push(packet);
      this.srcBufferUsed = newSrcBufferSize;

      if (!this.srcSending) {
        this.sendFromSrcBuffer();
      }
    } else {
      let newDstBufferSize = this.dstBufferUsed + packet.size;

      if (newDstBufferSize > this.bufferSize * BYTES_IN_KB) {
        console.log(`Dropping packets at ${this.id} due to buffer overflow.`);

        return;
      }

      this.dstBuffer.push(packet);
      this.dstBufferUsed = newDstBufferSize;

      if (!this.dstSending) {
        this.sendFromDstBuffer();
      }
    }
  }

  private notifyStatsUpdate(): void {
    this.latencyStats = [this.srcLatencyStats, this.dstLatencyStats];
    this.throughputStats = [this.srcThroughputStats, this.dstThroughputStats];
    this.lossRateStats = [this.srcLossRateStats, this.dstLossRateStats];

    console.log(this.latencyStats);
  }

  private updateSrcStats(): void {
    let now = Date.now();
    let latencyAvg = this.srcLatencyData
      .reduce((last, next) => last + next, 0) / Math.max(this.srcLatencyData.length, 1);

    this.srcLatencyStats.push({
      time: now,
      value: latencyAvg
    });

    if (this.srcLatencyStats.length > MAX_STATS_LENGTH) {
      this.srcLatencyStats.shift();
    }

    this.srcLatencyData = [];

    this.srcLossRateStats.push({
      time: now,
      value: this.srcLostPktCounter / Math.max(this.srcSentPktCounter, 1) * 100
    });

    if (this.srcLossRateStats.length > MAX_STATS_LENGTH) {
      this.srcLossRateStats.shift();
    }

    this.srcLostPktCounter = 0;
    this.srcSentPktCounter = 0;

    this.srcThroughputStats.push({
      time: now,
      value: this.srcThroughputCounter / (now - this.srcLastUpdated)
    });

    if (this.srcThroughputStats.length > MAX_STATS_LENGTH) {
      this.srcThroughputStats.shift();
    }

    this.srcLastUpdated = now;
    this.srcThroughputCounter = 0;

    this.srcStatsTimer = setTimeout(() => {
      this.updateSrcStats();
    }, STATS_UPDATE_INTERVAL);

    this.notifyStatsUpdate();
  }

  private updateDstStats(): void {
    let now = Date.now();
    let latencyAvg = this.dstLatencyData
      .reduce((last, next) => last + next, 0) / Math.max(this.dstLatencyData.length, 1);

    this.dstLatencyStats.push({
      time: now,
      value: latencyAvg
    });

    if (this.dstLatencyStats.length > MAX_STATS_LENGTH) {
      this.dstLatencyStats.shift();
    }

    this.dstLatencyData = [];

    this.dstLossRateStats.push({
      time: now,
      value: this.dstLostPktCounter / Math.max(this.dstSentPktCounter, 1) * 100
    });

    if (this.dstLossRateStats.length > MAX_STATS_LENGTH) {
      this.dstLossRateStats.shift();
    }

    this.dstLostPktCounter = 0;
    this.dstSentPktCounter = 0;

    this.dstThroughputStats.push({
      time: now,
      value: this.dstThroughputCounter / (now - this.dstLastUpdated)
    });

    if (this.dstThroughputStats.length > MAX_STATS_LENGTH) {
      this.dstThroughputStats.shift();
    }

    this.dstLastUpdated = now;
    this.dstThroughputCounter = 0;

    this.dstStatsTimer = setTimeout(() => {
      this.updateDstStats();
    }, STATS_UPDATE_INTERVAL);

    this.notifyStatsUpdate();
  }

  private sendFromSrcBuffer(): void {
    this.srcSending = true;

    if (this.srcBuffer.isEmpty()) {
      this.srcSending = false;

      return;
    }

    let packet = <Packet>this.srcBuffer.shift();

    this.srcBufferUsed = this.srcBufferUsed - packet.size;
    this.srcSentPktCounter++;

    packet.markSent();

    this.srcNextTimer = setTimeout(() => {
      this.sendFromSrcBuffer();
    }, packet.size / (this.capacity * BYTES_PER_MBPS) * TIME_SLOWDOWN);

    if (Math.random() * 100 < this.lossRate) {
      this.srcLostPktCounter++;
      console.log(`Packet lost at ${this.id}`);

      return;
    }

    let sendingTime = this.delay + packet.size / (this.capacity * BYTES_PER_MBPS);

    this.srcTransTimer = setTimeout(() => {
      packet.markReceived();
      this.srcLatencyData.push(packet.getTransTime());
      this.srcThroughputCounter = this.srcThroughputCounter + packet.size;

      setTimeout(() => {
        this.dst.receivePacket(packet, this);
      });
    }, sendingTime * TIME_SLOWDOWN);
  }

  private sendFromDstBuffer(): void {
    this.dstSending = true;

    if (this.dstBuffer.isEmpty()) {
      this.dstSending = false;

      return;
    }

    let packet = <Packet>this.dstBuffer.shift();

    this.dstBufferUsed = this.dstBufferUsed - packet.size;
    this.dstSentPktCounter++;

    packet.markSent();

    this.dstNextTimer = setTimeout(()=>{
      this.sendFromDstBuffer();
    }, packet.size / (this.capacity * BYTES_PER_MBPS) * TIME_SLOWDOWN);

    if (Math.random() * 100 < this.lossRate) {
      this.dstLostPktCounter++;
      console.log(`Packet lost at ${this.id}`);

      return;
    }

    let sendingTime = this.delay + packet.size / (this.capacity * BYTES_PER_MBPS);

    this.dstTransTimer = setTimeout(() => {
      packet.markReceived();
      this.dstLatencyData.push(packet.getTransTime());
      this.dstThroughputCounter = this.dstThroughputCounter + packet.size;

      setTimeout(() => {
        this.src.receivePacket(packet, this);
      });

    }, Math.floor(sendingTime * TIME_SLOWDOWN));
  }

  public cleanUp(): void {
    // Stop ongoing transmission
    clearTimeout(this.srcTransTimer);
    clearTimeout(this.dstTransTimer);
    clearTimeout(this.srcNextTimer);
    clearTimeout(this.dstNextTimer);
    clearTimeout(this.srcStatsTimer);
    clearTimeout(this.dstStatsTimer);
  }

  public updateMetric(metric: number): void {
    this.metric = metric;

    for (let node of [this.src, this.dst]) {
      if (node instanceof Router) {
        node.advertiseLsa(this);
      }
    }
  }
}


export class Interface {
  constructor(public port: number, public ip: string, public link: Link) {}
}

export class Route {
  constructor(public ip: string, public nextHop: Device) {}
}

export enum PacketType {
  Payload,
  Ack,
  LinkUp,
  LinkDown,
  LSA,
  Syn,
  SynAck
}

const INIT_TTL = 64;

export class Packet {
  public ttl: number = INIT_TTL;
  private sentTime: number;
  private receivedTime: number;

  constructor(public flowId:number, public srcIp: string, public dstIp: string, public type: PacketType,
    public sequenceNumber: number, public size: number, public payload?: any) {
  }

  public markSent(): void {
    this.sentTime = Date.now();
  }

  public markReceived(): void {
    this.receivedTime = Date.now();
  }

  public getTransTime(): number {
    return this.receivedTime - this.sentTime;
  }

  public getFlowId(): number {
    return this.flowId;
  }
}

export class Flow {

  public flowId: number;
  public flowSource: string;
  public flowDestination: string;
  public sendingHost: Host;
  public dataAmount: number;
  public initTime: number;
  public waitingTime: number;
  public packetList: Packet[];
  public packetSYN:Packet;
  public packetACK: Packet;
  public algorithm: AlgType;
  public flowStatus: FlowStatus;
  public cwnd: number;
  public RTT: number;
  public RTO: number;
  public ssthresh: number;
  public windowStart: number;
  public toSend: number;
  public maxAck: number = 0;
  public maxAckDup: number = 0;
  public timeSYN: number;
  public timeSYNACK: number;
  public eventList: any [] = [];

  constructor(public id: number, public src: Host, public destIP: string, public data: number, public time: number) {
    this.flowId = id;
    this.flowSource = src.getIp();
    this.flowDestination = destIP + "/24";
    this.sendingHost = src;
    this.dataAmount = data; // in MB
    data = data * MEGA;  // in Byte
    this.waitingTime = time;
    this.initTime = Date.now();
    this.algorithm = AlgType[src.algorithm];

    let seqNum = 1;

    this.packetList = [];

    while (data > 0) {
      let pktSize = Math.min(data, PAYLOAD_SIZE);

      this.packetList.push(new Packet(this.flowId, src.getIp(), destIP + "/24", PacketType.Payload, seqNum, HEADER_SIZE + pktSize))
      seqNum++;
      data = data - pktSize;
    }

    this.flowStatus = FlowStatus.Waiting;

    for (let n = 0; n < time; n++) {
      setTimeout(() => this.countDown(), (n + 1) * 1000);
    }

    setTimeout(() => this.handShake(), time * 1000);
  }

  private countDown(): void {
    this.waitingTime--;
  }

  private handShake(): void {
    this.flowStatus = FlowStatus.HandShake;
    this.packetSYN = new Packet(this.flowId, this.flowSource, this.flowDestination, PacketType.Syn, 0, CTL_SIZE);
    this.timeSYN = Date.now();
    setTimeout(() => this.sendingHost.sendPacket(this.packetSYN));
  }

  public onReceive(packet: Packet): void {
    if (packet.type === PacketType.SynAck) {
      this.packetACK = new Packet(this.flowId, this.flowSource, this.flowDestination, PacketType.Ack, 1, CTL_SIZE);
      setTimeout(() => this.sendingHost.sendPacket(this.packetACK));
      this.timeSYNACK = Date.now();
      this.RTT = this.timeSYNACK - this.timeSYN;
      this.RTO = BETA * this.RTT;

      switch(this.algorithm) {
        case AlgType.Reno:
          this.sendPackets_Reno();
          break;
        case AlgType.Vegas:
          break;
        default:
          break;
      }

      return;
    }

    if (packet.type === PacketType.Ack) {
      switch(this.algorithm) {
        case AlgType.Reno:
          this.onReceiveAck_Reno(packet);
          break;
        case AlgType.Vegas:
          break;
        default:
          break;
      }
    }
  }

//-------- Below is the code for TCP Reno --------
  private sendPackets_Reno(): void {
    this.cwnd = 1;
    this.ssthresh = SSTHRESH_INIT;
    this.toSend = 0;
    this.windowStart = 0;
    this.slowStart();
  }

  private send(): void {
    let stop = this.windowStart + this.cwnd;

    for (let i = this.toSend; i < stop && i < this.packetList.length; i++) {
      let pkt = this.packetList[this.toSend];

      this.eventList.push(setTimeout(() => this.sendingHost.sendPacket(pkt)));
      this.eventList.push(setTimeout(() => this.timeOut(pkt), this.RTO));

      this.toSend++;
    }
  }

  private slowStart(): void {
    this.flowStatus = FlowStatus.SS;
    this.send();
  }

  private congestionAvoidance(): void {
    this.flowStatus = FlowStatus.CA;
    this.send();
  }

  private frfr(): void {
    this.flowStatus = FlowStatus.FRFR;
    this.send();
  }

  private timeOut(pkt: Packet): void {
    if (pkt.sequenceNumber > this.windowStart) {
      // Meaning this packet has not been ack'ed yet
//      for (var i = 0; i < this.eventList.length; i++) {
//        clearTimeout(this.eventList[i]);
//      }
//      this.eventList.length = 0;
      this.eventList.push(setTimeout(() => this.sendingHost.sendPacket(pkt)));
      this.eventList.push(setTimeout(() => this.timeOut(pkt), this.RTO));
      this.cwnd = 1; // According to Page 7, https://tools.ietf.org/html/rfc5681#section-3.1
      let flightSize = this.toSend - this.windowStart;
      this.ssthresh = Math.max(flightSize/2, 2);
      this.slowStart();
    } else {
      return;
    }
  }

  public onReceiveAck_Reno(packet: Packet): void {
    if (packet.sequenceNumber > this.packetList.length) {
      if(this.flowStatus !== FlowStatus.Complete){
        this.windowStart = packet.sequenceNumber - 1;
        this.flowStatus = FlowStatus.Complete;
      }
      return;
    }

    if (packet.sequenceNumber > this.maxAck) {
      this.maxAck = packet.sequenceNumber;
      this.maxAckDup = 1;

      if (this.flowStatus === FlowStatus.FRFR) {
        this.cwnd = this.ssthresh;
        this.windowStart = packet.sequenceNumber - 1;
        this.congestionAvoidance();
        return;
      }

      if (this.cwnd < this.ssthresh) {
        this.windowStart = packet.sequenceNumber - 1;
        this.cwnd = this.cwnd + 1;
        this.slowStart();
      } else {
        this.windowStart = packet.sequenceNumber - 1;
        this.cwnd = this.cwnd + 1.0 / this.cwnd;
        this.congestionAvoidance();
      }
    } else {
      this.maxAckDup++;
      if (this.maxAckDup === 3) {
        // 3 dup ACK, fast retransmit and fast recovery
        let flightSize = this.toSend - this.windowStart;
        this.ssthresh = Math.max(flightSize/2, 2);
        this.cwnd = this.ssthresh + 3;
        let pkt = this.packetList[this.maxAck - 1];
        this.eventList.push(setTimeout(() => this.sendingHost.sendPacket(pkt)));
        this.eventList.push(setTimeout(() => this.timeOut(pkt), this.RTO));
        this.frfr();
      } else if (this.maxAckDup > 3) {
        // Additional dup arrives, need to inflate cwnd artificially
        this.cwnd++;
        this.frfr();
      }
    }
  }
//-------- Above is the code for TCP Reno --------
}

export class FlowReceived {
  public flowId: number; // id of the received flow
  public rwnd: number; // Receive window size
  public pktRecieved: number[]; // seq numbers of received packets
  public nextAck: number; // seq number of the the next Ack packet

  constructor(public id: number) {
    this.flowId = id;
    this.rwnd = RWND_INIT;
    this.pktRecieved = [];
    this.nextAck = 1;
  }

  public onReceive(packet: Packet): void {
    this.pktRecieved.push(packet.sequenceNumber);
    if (this.pktRecieved.length > this.rwnd) {
      this.pktRecieved.shift();
    }
    while(this.pktRecieved.includes(this.nextAck)) {
      this.nextAck++;
    }
  }

  public getAckSeqNum(): number {
    return this.nextAck;
  }
}

export enum AlgType {
  Reno,
  Vegas,
  FAST
}

export enum FlowStatus {
  Waiting,
  Complete,
  SS, // slow start
  CA, // comgestion avoidance
  FRFR,// fast retansmit/fast recovery
  HandShake
}
