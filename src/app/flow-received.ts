import { RWND_INIT } from './constants';
import { FlowReceived } from './network-devices';
import { Packet } from './packet';

export class FlowReceivedProvider implements FlowReceived {
  public rwnd: number; // receive window size
  public pktRecieved: number[]; // seq numbers of received packets
  public nextAck: number; // seq number of the the next Ack packet

  constructor(public flowId: string) {
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
