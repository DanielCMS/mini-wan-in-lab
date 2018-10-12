import { Host, Packet, PacketType } from './network-devices'
import { PKT_SIZE, HEADER_SIZE, PAYLOAD_SIZE, CTL_SIZE,
  RWND_INIT, SSTHRESH_INIT, BETA, MEGA } from './constants';

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
