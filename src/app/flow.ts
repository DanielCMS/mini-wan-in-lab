import {Host, Packet, PacketType} from './network-devices'
import { PKT_SIZE, HEADER_SIZE, PAYLOAD_SIZE, CTL_SIZE, RWND_INIT, SSTHRESH_INIT, BETA, MEGA } from './constants';

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
  constructor(public id: number, public src: Host, public destIP: string, public data: number, public time: number) {
    this.flowId = id;
    this.flowSource = src.getIp();
    this.flowDestination = destIP + "/24";
    this.sendingHost = src;
    this.dataAmount = data;
    data = data * MEGA;
    this.waitingTime = time;
    this.initTime = new Date().getTime();
    this.algorithm = AlgType[src.algorithm];
    let seqNum = 1;
    this.packetList = [];
    while (data > 0){
      let pkt_size = Math.min(data, PAYLOAD_SIZE);
      this.packetList.push(new Packet(this.flowId, src.getIp(), destIP + "/24", PacketType.Payload, seqNum, HEADER_SIZE + pkt_size))
      seqNum++;
      data = data - pkt_size;
    }
    this.flowStatus = FlowStatus.Waiting;
    for(var n = 0; n < time; n++ ){
      setTimeout(()=>this.countDown(), (n+1)*1000);
    }
    setTimeout(()=>this.handShake(), time * 1000);
  }

  private countDown(): void {
    this.waitingTime--;
  }

  private handShake(): void {
    this.flowStatus = FlowStatus.HandShake;
    this.packetSYN = new Packet(this.flowId, this.flowSource, this.flowDestination, PacketType.Syn, 0, CTL_SIZE);
    setTimeout(()=>this.sendingHost.sendPacket(this.packetSYN));
  }

  public onReceive(packet: Packet): void {
    if (packet.type === PacketType.SynAck) {
      this.packetACK = new Packet(this.flowId, this.flowSource, this.flowDestination, PacketType.Ack, 1, CTL_SIZE);
      setTimeout(()=>this.sendingHost.sendPacket(this.packetACK));
      this.RTT = packet.getTransTime() + this.packetSYN.getTransTime();
      this.RTO = BETA * this.RTT;
      this.sendPackets();
    }

    if (packet.type === PacketType.Ack) {
      if (this.toSend >= this.packetList.length) {
        this.flowStatus = FlowStatus.Complete;
        return;
      }
      if (this.cwnd < this.ssthresh) {
        this.flowStatus = FlowStatus.SlowStart;
        this.windowStart = packet.sequenceNumber;
        this.cwnd = this.cwnd + 1;
        this.slowStart();
      } else {
        this.flowStatus = FlowStatus.CA;
        this.cwnd = this.cwnd + 1.0/this.cwnd;

      }
    }

  }

  private sendPackets(): void {
    this.flowStatus = FlowStatus.SlowStart;
    this.cwnd = 1;
    this.ssthresh = SSTHRESH_INIT;
    this.toSend = 0;
    this.windowStart = 0;
    this.slowStart();
  }

  private slowStart(): void {
    let i = this.toSend;
    let stop = this.windowStart + this.cwnd;
    for (; i < stop && i < this.packetList.length; i++) {
      let pkt = this.packetList[this.toSend];
      setTimeout(()=>this.sendingHost.sendPacket(pkt));
      this.toSend++;
    }
  }

}

export class FlowReceived {
  public flowId: number;          // id of the received flow
  public rwnd: number;            // Receive window size
  public pktRecieved: number[];   // seq numbers of received packets
  public nextAck: number;         // seq number of the the next Ack packet
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
  SlowStart,
  Retransmit,
  CA,
  FRFR,
  HandShake
}