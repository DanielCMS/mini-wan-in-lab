import { v4 } from 'uuid';
import { Vector } from './vector';
import { CTL_SIZE } from './constants';
import { Packet, PacketType } from './packet';
import { BaseDevice } from './base-device';
import { Host, Flow, Link, FlowReceived, AlgType } from './network-devices';
import { FlowReceivedProvider } from './flow-received';
import { FlowProvider } from './flow';

export class HostProvider extends BaseDevice implements Host {
  public isHost: boolean = true;
  public flowList: Flow[] = [];
  public receiveList: FlowReceived[] = [];

  constructor(public id: string, public label: string, public position: Vector) {
    super(id, label, position);

    this.position = {
      x: this.position.x - 12,
      y: this.position.y + 25
    };
  }

  public addNewFlow(dest: string, data: number, alg: AlgType, startTime: number): void {
    this.flowList.push(new FlowProvider(v4(), this, dest, data, alg, startTime));
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
    if (packet.dstIp !== this.getIp()) {
      return;
    }

    let flowId = packet.getFlowId();

    if (packet.type === PacketType.Syn) {
      let flow = new FlowReceivedProvider(flowId);

      this.receiveList.push(flow); // Establish the session

      let pkt = new Packet(flowId, this.getIp(), packet.srcIp, PacketType.SynAck, 0, CTL_SIZE);

      setTimeout(() => this.sendPacket(pkt));

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
    let gateway = this.interfaces[0];

    if (gateway) {
      gateway.link.sendPacketFrom(this, packet);
    } else {
      console.log(`Dropping packet at ${this.label} due to missing gateway.`);
    }
  }
}
