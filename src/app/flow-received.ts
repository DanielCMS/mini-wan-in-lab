import { CTL_SIZE } from './constants';
import { Host, FlowReceived } from './network-devices';
import { Packet, PacketType } from './packet';

export class FlowReceivedProvider implements FlowReceived {
  private pktsReceived: number[] = []; // seq numbers of received packets
  private nextAck: number = 0; // seq number of the the next Ack packet

  constructor(public flowId: string, private host: Host) {}

  public onReceive(packet: Packet): void {
    let seq = packet.sequenceNumber;

    if (seq >= this.nextAck) {
      this.pktsReceived.push(seq);
    }

    if (seq === this.nextAck) {
      console.log(this.pktsReceived);
      console.log(this.nextAck);
      this.updateNextAck();
      this.deliverReceivedPkts();
    }

    let pkt = new Packet(this.flowId, packet.dstIp, packet.srcIp, PacketType.Ack, this.nextAck, CTL_SIZE, packet.getTSval());

    setTimeout(() => this.host.sendPacket(pkt));
  }

  private deliverReceivedPkts(): void {
    this.pktsReceived = this.pktsReceived.filter(seq => seq >= this.nextAck);
  }

  private updateNextAck(): void {
    while (this.pktsReceived.includes(this.nextAck)) {
      this.nextAck++;
    }
  }
}
