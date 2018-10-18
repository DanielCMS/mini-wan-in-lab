import { HEADER_SIZE, PAYLOAD_SIZE, CTL_SIZE, SSTHRESH_INIT,
  AVG_LENGTH, ALPHA, BETA, MIN_RTO, BYTES_PER_MB, MAX_STATS_LENGTH,
  BPMS_PER_MBPS, TIME_SLOWDOWN } from './constants';
import { Packet, PacketType } from './packet';
import { SeriesPoint } from './series-point';
import { AlgType, Flow, CongestionControlAlg, FlowStatus, Host } from './network-devices';
import { Tahoe, Reno, Vegas, FAST } from './congestion-control';

const COUNTDOWN_INTERVAL = 1000;
const STATS_UPDATE_INTERVAL = 1000;
const SAMPLE_INTERVAL = 250;

export class FlowProvider implements Flow {

  private flowSource: string;
  private RTT: number;
  private RTTMin: number;
  private RTO: number;
  private windowStart: number = 0;
  private maxAck: number = 0;
  private seqNum: number = 0;
  private packetsOnFly: Packet[] = [];
  private congestionControl: CongestionControlAlg;
  private RTOTimer: number;
  private sampleTimer: number;
  private statsTimer: number;

  public dataRemaining: number;
  public flowDestination: string;
  public isFlow: boolean = true;
  public flowStatus: FlowStatus = FlowStatus.Waiting;
  public cwnd: number = 1;
  public maxAckDup: number = 0;
  public ssthresh: number = SSTHRESH_INIT;

  public rateStats: SeriesPoint[][] = [];
  public cwndStats: SeriesPoint[][] = [];
  public rttStats: SeriesPoint[][] = [];

  private rateCounter: number = 0;
  private cwndData: number[] = [];
  private rttData: number[] = [];
  private lastUpdated: number;
  private _rateStats: SeriesPoint[] = [];
  private _cwndStats: SeriesPoint[] = [];
  private _rttStats: SeriesPoint[] = [];

  private rateRaw: number[] = [];
  private cwndRaw: number[] = [];
  private rttRaw: number[] = [];

  constructor(public flowId: string, public sendingHost: Host, public destIP: string, public data: number, public algorithm: AlgType, private countdown: number) {
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
    let packet =  new Packet(this.flowId, this.flowSource, this.flowDestination, PacketType.Syn, 0, CTL_SIZE);

    setTimeout(() => this.sendingHost.sendPacket(packet));

    this.lastUpdated = Date.now();
    this.sample();
    this.updateStats();
  }

  private sample(): void {
    this.cwndData.push(this.cwnd);
    this.rttData.push(this.RTT);

    this.sampleTimer = setTimeout(() => this.sample(), SAMPLE_INTERVAL);
  }

  private pushRawAndGetAvg(value: number, raw: number[]): number {
    if (value) {
      raw.push(value);
    }

    if (raw.length > AVG_LENGTH) {
      raw.shift();
    }

    return raw.reduce((last, next) => last + next, 0) / Math.max(raw.length, 1);
  }

  private updateStats(): void {
    let now = Date.now();

    // Update rtt
    let rttAvg = this.rttData
      .reduce((last, next) => last + next, 0) / Math.max(this.rttData.length, 1) / TIME_SLOWDOWN;

    this.pushRawAndGetAvg(rttAvg, this.rttRaw);

    this._rttStats.push({
      time: now,
      value: rttAvg
    });

    if (this._rttStats.length > MAX_STATS_LENGTH) {
      this._rttStats.shift();
    }

    this.rttData = [];
    this.rttStats = [this._rttStats];

    // Update cwnd
    let cwndAvg = this.cwndData
      .reduce((last, next) => last + next, 0) / Math.max(this.cwndData.length, 1);

    this.pushRawAndGetAvg(cwndAvg, this.cwndRaw);

    this._cwndStats.push({
      time: now,
      value: cwndAvg
    });

    if (this._cwndStats.length > MAX_STATS_LENGTH) {
      this._cwndStats.shift();
    }

    this.cwndData = [];
    this.cwndStats = [this._cwndStats];

    // Update rate
    let rate = this.rateCounter / Math.max(now - this.lastUpdated, 1) * TIME_SLOWDOWN / BPMS_PER_MBPS;
    let avg = this.pushRawAndGetAvg(rate, this.rateRaw);

    this._rateStats.push({
      time: now,
      value: avg
    });

    if (this._rateStats.length > MAX_STATS_LENGTH) {
      this._rateStats.shift();
    }

    this.lastUpdated = now;
    this.rateCounter = 0;
    this.rateStats = [this._rateStats];

    // Schedule a future updates
    this.statsTimer = setTimeout(() => {
      this.updateStats();
    }, STATS_UPDATE_INTERVAL);

  }

  private stopTimers(): void {
    clearTimeout(this.sampleTimer);
    clearTimeout(this.statsTimer);
    clearTimeout(this.RTOTimer);
  }

  private updateRTT(RTT: number): void {
    if (this.RTT) {
      this.RTT = (1 - ALPHA) * this.RTT + ALPHA * RTT;
      this.RTTMin  =Math.min(this.RTTMin, RTT);
    } else {
      this.RTT = RTT;
      this.RTTMin = RTT;
    }
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
        this.stopTimers();

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

    this.rateCounter = this.rateCounter + PAYLOAD_SIZE;
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
