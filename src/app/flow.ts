import { HEADER_SIZE, PAYLOAD_SIZE, CTL_SIZE, RWND_INIT, SSTHRESH_INIT,
  ALPHA, BETA, MIN_RTO, BYTES_PER_MB } from './constants';
import { Packet, PacketType } from './packet';
import { SeriesPoint } from './series-point';
import { AlgType, Flow, CongestionControlAlg, FlowStatus, Host } from './network-devices';
import { Tahoe, Reno, Vegas, FAST } from './congestion-control';

const COUNTDOWN_INTERVAL = 1000;

export class FlowProvider implements Flow {

  private flowSource: string;
  private flowDestination: string;
  private dataRemaining: number;
  private RTT: number;
  private RTO: number;
  private windowStart: number = 0;
  private maxAck: number = 0;
  private timeSYN: number;
  private seqNum: number = 0;
  private packetsOnFly: Packet[] = [];
  private congestionControl: CongestionControlAlg;
  private RTOTimer: number;

  public isFlow: boolean = true;
  public flowStatus: FlowStatus = FlowStatus.Waiting;
  public cwnd: number = 1;
  public maxAckDup: number = 0;
  public ssthresh: number = SSTHRESH_INIT;

  public rateStats: SeriesPoint[][] = [];
  public cwndStats: SeriesPoint[][] = [];
  public rttStats: SeriesPoint[][] = [];

  constructor(public flowId: string, public sendingHost: Host, public destIP: string, public data: number, private algorithm: AlgType, private countdown: number) {
    this.flowSource = sendingHost.getIp();
    this.flowDestination = destIP + "/24";
    this.dataRemaining = data * BYTES_PER_MB; // in Bytes
    this.updateAlg(algorithm);

    this.countDown();
  }

  public updateAlg(alg: AlgType): void {
    this.algorithm = alg;

    if (alg === AlgType.Tahoe) {
      this.congestionControl = new Tahoe(this);
    } else if (alg === AlgType.Reno) {
      this.congestionControl = new Reno(this);
    } else if (alg === AlgType.Vegas) {
      this.congestionControl = new Vegas(this);
    } else if (alg === AlgType.FAST) {
      this.congestionControl = new FAST(this);
    }
  }

  private countDown(): void {
    if (this.countdown > 0) {
      setTimeout(() => {
        this.countDown();
        this.countdown--;
      }, COUNTDOWN_INTERVAL);
    } else {
      this.handShake();
    }
  }

  private handShake(): void {
    this.flowStatus = FlowStatus.HandShake;
    this.timeSYN = Date.now();
    let packet =  new Packet(this.flowId, this.flowSource, this.flowDestination, PacketType.Syn, 0, CTL_SIZE);

    setTimeout(() => this.sendingHost.sendPacket(packet));
  }

  private updateRTT(RTT: number): void {
    if (this.RTT) {
      this.RTT = (1 - ALPHA) * this.RTT + ALPHA * RTT;
    } else {
      this.RTT = RTT;
    }
  }

  private updateRTO(): void {
    this.RTO = Math.max(this.RTT * BETA, MIN_RTO);
  }

  public onReceive(packet: Packet): void {
    if (packet.type === PacketType.SynAck) {
      let ack = new Packet(this.flowId, this.flowSource, this.flowDestination, PacketType.Ack, 1, CTL_SIZE);

      setTimeout(() => this.sendingHost.sendPacket(ack));

      this.updateRTT(Date.now() - this.timeSYN);
      this.updateRTO();
      this.flowStatus = FlowStatus.SS;
    }

    if (packet.type === PacketType.Ack) {
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
}
