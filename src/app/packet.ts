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
  private TSval: number; // Time Stamp Value  see https://tools.ietf.org/html/rfc1323#section-3
  private TSecr: number; // Time Stamp Echo

  constructor(public flowId: string, public srcIp: string, public dstIp: string, public type: PacketType,
    public sequenceNumber: number, public size: number, public payload?: any) {
    if (type === PacketType.Payload || type === PacketType.Syn) {
      this.setTSval(Date.now());
    } else if ((type === PacketType.Ack && sequenceNumber > 0) || type === PacketType.SynAck) {
      this.setTSecr(payload);
    }
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

  public getTSval(): number {
    return this.TSval;
  }
  public getTSecr(): number {
    return this.TSecr;
  }

  public setTSval(v: number): void {
    this.TSval = v;
  }
  public setTSecr(v: number): void {
    this.TSecr = v;
  }

}
