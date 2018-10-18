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
    let pkts = this.pktsReceived;
    let ack = this.nextAck;
    let swap = (i, j) => {
      let tmp = pkts[i];

      pkts[i] = pkts[j];
      pkts[j] = tmp;
    };

    for (let i = 0; i < pkts.length; i++) {
      while (pkts[i] - ack < pkts.length
        && pkts[i] !== i + ack
        && pkts[i] !== pkts[pkts[i] - ack]) {
        swap(i, pkts[i] - ack);
      }

      for (let i = 0; i < pkts.length; i++) {
        if (pkts[i] !== i + ack) {
          this.nextAck = i + ack;

          return;
        }
      }
    }

    this.nextAck = pkts.length + ack;
  }
}
