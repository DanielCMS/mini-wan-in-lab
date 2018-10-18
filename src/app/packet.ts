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

  constructor(public flowId: string, public srcIp: string, public dstIp: string, public type: PacketType,
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

  public getFlowId(): string {
    return this.flowId;
  }
}
