import { HEADER_SIZE, PAYLOAD_SIZE, CTL_SIZE, RWND_INIT, SSTHRESH_INIT,
  ALPHA, BETA, MIN_RTO, MEGA } from './constants';
import { Packet, PacketType } from './packet';
import { AlgType, Flow, CongestionControlAlg, FlowStatus, Host } from './network-devices';
import { Reno, Vegas } from './congestion-control';

export class FlowProvider implements Flow {
//  private initTime: number;
  private waitingTime: number;
  private flowSource: string;
  private flowDestination: string;
  private dataRemaining: number;
  private algorithm: AlgType;
  private RTT: number;
  private RTTMin: number;
  private RTO: number;
  private windowStart: number = 0;
  private toSend: number;
  private maxAck: number = 0;
  private seqNum: number = 0;
  private packetsOnFly: Packet[] = [];
  private congestionControl: CongestionControlAlg;
  private RTOTimer: number;

  public flowStatus: FlowStatus = FlowStatus.Waiting;
  public cwnd: number = 1;
  public maxAckDup: number = 0;
  public ssthresh: number = SSTHRESH_INIT;

  constructor(public flowId: number, public sendingHost: Host, public destIP: string, public data: number, public time: number) {
    this.flowSource = sendingHost.getIp();
    this.flowDestination = destIP + "/24";
    this.dataRemaining = data * MEGA; // in Bytes
    this.waitingTime = time;
    //    this.initTime = Date.now();
    if (this.sendingHost.algorithm === AlgType[AlgType.Reno]) {
      this.congestionControl = new Reno(this);
      console.log('Reno is in use');
    } else if (this.sendingHost.algorithm === AlgType[AlgType.Vegas]) {
      this.congestionControl = new Vegas(this);
      console.log('Vegas is in use');
    }


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
    let packet =  new Packet(this.flowId, this.flowSource, this.flowDestination, PacketType.Syn, 0, CTL_SIZE);

    setTimeout(() => this.sendingHost.sendPacket(packet));
  }

  private updateRTT(RTT: number): void {
    if (this.RTT) {
      this.RTT = (1 - ALPHA) * this.RTT + ALPHA * RTT;
      this.RTTMin  =Math.min(this.RTTMin, RTT);
    } else {
      this.RTT = RTT;
      this.RTTMin = RTT;
    }
    console.log('new RTT', this.RTT);
  }

  private updateRTO(): void {
    this.RTO = Math.max(this.RTT * BETA, MIN_RTO);
  }

  public onReceive(packet: Packet): void {
    if (packet.type === PacketType.SynAck) {
      let ack = new Packet(this.flowId, this.flowSource, this.flowDestination, PacketType.Ack, 1, CTL_SIZE);

      setTimeout(() => this.sendingHost.sendPacket(ack));
      let RTT = Date.now() - packet.getTSecr();
      this.updateRTT(RTT);
      this.updateRTO();
      this.flowStatus = FlowStatus.SS;
    }

    if (packet.type === PacketType.Ack) {
      let RTT = Date.now() - packet.getTSecr();
      this.updateRTT(RTT);
      this.updateRTO();
      this.windowStart = packet.sequenceNumber;
      this.packetsOnFly = this.packetsOnFly.filter(pkt => pkt.sequenceNumber >= packet.sequenceNumber);

      if (this.packetsOnFly.length === 0 && this.dataRemaining <= 0) {
        this.flowStatus = FlowStatus.Complete;

        return;
      }

      if (packet.sequenceNumber > this.maxAck) {
        this.maxAck = packet.sequenceNumber;
        this.maxAckDup = 1;

        this.onReceiveNewAck();
      } else {
        this.maxAckDup++;
        this.onReceiveDupAck();
      }
    }

    this.send();
  }

  private restartRTO(): void {
    clearTimeout(this.RTOTimer);
    this.RTOTimer = setTimeout(() => {
      this.onTimeout();
    }, this.RTO);
  }

  private collapseSsthresh(): void {
    let flightSize = this.packetsOnFly.length;

    this.ssthresh = Math.floor(Math.max(flightSize / 2, 2));
  }

  private retransmit(): void {
    let pkt = this.packetsOnFly[0];

    if (pkt) {
      setTimeout(() => this.sendingHost.sendPacket(<Packet>pkt));
    }
  }

  private onReceiveNewAck(): void {
    if (this.flowStatus === FlowStatus.SS) {
      this.cwnd++;

      if (this.cwnd >= this.ssthresh) {
        this.flowStatus = FlowStatus.CA;
        console.log('Enter CA');
      }
    }

    this.restartRTO();
    this.congestionControl.onReceiveNewAck();
  }

  private onReceiveDupAck(): void {
    if (this.maxAckDup === 3) {
      // 3 dup ACK, packet lost
      this.retransmit();
      this.collapseSsthresh();
    }

    this.congestionControl.onReceiveDupAck();
  }

  private createPacket(): (Packet | void) {
    if (this.dataRemaining <= 0) {
      return;
    }

    let pktSize = Math.min(this.dataRemaining, PAYLOAD_SIZE);
    let packet = new Packet(this.flowId, this.flowSource, this.flowDestination, PacketType.Payload, this.seqNum, HEADER_SIZE + pktSize)

    this.seqNum++;

    let lastOnFlight = this.packetsOnFly.slice(-1)[0];

    if (lastOnFlight && this.seqNum < lastOnFlight.sequenceNumber) {
      console.log("Retransmitting on flight packet");
    } else {
      this.dataRemaining = this.dataRemaining - pktSize;
    }

    return packet;
  }

  private send(): void {
    let stop = this.windowStart + this.cwnd;

    while (this.seqNum < stop) {
      let pkt = this.createPacket();

      if (pkt) {
        setTimeout(() => this.sendingHost.sendPacket(<Packet>pkt));
        this.packetsOnFly.push(pkt);
      } else {
        break;
      }
    }
  }

  private onTimeout(): void {
    this.retransmit();
    this.collapseSsthresh();

    // Exponential backoff
    this.RTO = this.RTO * 2;
    this.restartRTO();

    this.cwnd = 1;
    this.flowStatus = FlowStatus.SS;
    this.seqNum = this.maxAck;

    this.send();
  }

  public getRTT(): number {
    return this.RTT;
  }

  public getRTTMin(): number {
    return this.RTTMin;
  }
}
