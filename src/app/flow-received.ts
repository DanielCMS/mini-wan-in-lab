import { RWND_INIT } from './constants';
import { FlowReceived } from './network-devices';
import { Packet } from './packet';

export class FlowReceivedProvider implements FlowReceived {
  public rwnd: number = RWND_INIT; // receive window size
  public pktReceived: number[] = []; // seq numbers of received packets
  public nextAck: number = 1; // seq number of the the next Ack packet

  constructor(public flowId: string) {}

  public onReceive(packet: Packet): void {
    this.pktReceived.push(packet.sequenceNumber);
    if (this.pktReceived.length > this.rwnd) {
      this.pktReceived.shift();
    }
    while(this.pktReceived.includes(this.nextAck)) {
      this.nextAck++;
    }
  }

  public getAckSeqNum(): number {
    return this.nextAck;
  }
}
