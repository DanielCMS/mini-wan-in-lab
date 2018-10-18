import * as Deque from 'double-ended-queue';
import { TIME_SLOWDOWN } from './constants';
import { SeriesPoint } from './series-point';
import { Packet, PacketType } from './packet';
import { Device, Router, Host, Link, isRouter, isHost } from './network-devices';

const DEFAULT_CAP = 10;
const DEFAULT_DELAY = 10;
const DEFAULT_LOSS_RATE = 0.1;
const DEFAULT_BUFFER_SIZE = 64;
const DEFAULT_METRIC = 100;
const BYTES_IN_KB = 1000;
const BYTES_PER_MBPS = 125000;
const BPMS_PER_MBPS = 125;
const STATS_UPDATE_INTERVAL = 1000; // 1s
const MAX_STATS_LENGTH = 80;
const AVG_LENGTH = 0.1 * TIME_SLOWDOWN;

export class LinkProvider implements Link {
  public isLink: boolean = true;
  public capacity: number = DEFAULT_CAP;
  public delay: number = DEFAULT_DELAY;
  public lossRate: number = DEFAULT_LOSS_RATE;
  public bufferSize: number = DEFAULT_BUFFER_SIZE;
  public metric: number = DEFAULT_METRIC;

  public latencyStats: SeriesPoint[][] = [];
  public packetLossStats: SeriesPoint[][] = [];
  public throughputStats: SeriesPoint[][] = [];
  public bufferSizeStats: SeriesPoint[][] = [];

  private srcBuffer = new Deque();
  private dstBuffer = new Deque();
  private srcBufferUsed: number = 0;
  private dstBufferUsed: number = 0;

  private srcSending: boolean = false;
  private dstSending: boolean = false;

  private srcLatencyData: number[] = [];
  private srcBufferData: number[] = [];
  private srcLostPktCounter: number = 0;
  private srcThroughputCounter: number = 0;

  private srcLatencyRaw: number[] = [];
  private srcLatencyStats: SeriesPoint[] = [];
  private srcPacketLossStats: SeriesPoint[] = [];
  private srcThroughputRaw: number[] = [];
  private srcThroughputStats: SeriesPoint[] = [];
  private srcBufferSizeRaw: number[] = [];
  private srcBufferSizeStats: SeriesPoint[] = [];
  private srcLastUpdated: number;

  private dstLatencyData: number[] = [];
  private dstBufferData: number[] = [];
  private dstLostPktCounter: number = 0;
  private dstThroughputCounter: number = 0;

  private dstLatencyRaw: number[] = [];
  private dstLatencyStats: SeriesPoint[] = [];
  private dstPacketLossStats: SeriesPoint[] = [];
  private dstThroughputRaw: number[] = [];
  private dstThroughputStats: SeriesPoint[] = [];
  private dstBufferSizeRaw: number[] = [];
  private dstBufferSizeStats: SeriesPoint[] = [];
  private dstLastUpdated: number;

  private srcTransTimer: number;
  private dstTransTimer: number;
  private srcNextTimer: number;
  private dstNextTimer: number;
  private srcStatsTimer: number;
  private dstStatsTimer: number;

  constructor(public id: string, public src: Device, public dst: Device) {
    let now = Date.now();

    this.srcLastUpdated = now;
    this.dstLastUpdated = now;

    this.updateSrcStats();
    this.updateDstStats();
  }

  public getOtherEnd(element: Device): Device {
    if (element === this.src) {
      return this.dst;
    } else {
      return this.src;
    }
  }

  public getHostIfPresent(): (Host | void) {
    if (isHost(this.src)) {
      return this.src;
    } else if (isHost(this.dst)) {
      return this.dst;
    }
  }

  public sendPacketFrom(source: Device, packet: Packet): void {
    if (source === this.src) {
      let newSrcBufferSize = this.srcBufferUsed + packet.size;

      if (newSrcBufferSize > this.bufferSize * BYTES_IN_KB && isRouter(source)) {
        console.log(`Dropping packets at ${this.id} due to buffer overflow.`);

        return;
      }

      this.srcBuffer.push(packet);
      this.srcBufferData.push(newSrcBufferSize);
      this.srcBufferUsed = newSrcBufferSize;

      if (!this.srcSending) {
        this.sendFromSrcBuffer();
      }
    } else {
      let newDstBufferSize = this.dstBufferUsed + packet.size;

      if (newDstBufferSize > this.bufferSize * BYTES_IN_KB && isRouter(source)) {
        console.log(`Dropping packets at ${this.id} due to buffer overflow.`);

        return;
      }

      this.dstBuffer.push(packet);
      this.dstBufferData.push(newDstBufferSize);
      this.dstBufferUsed = newDstBufferSize;

      if (!this.dstSending) {
        this.sendFromDstBuffer();
      }
    }
  }

  private notifyStatsUpdate(): void {
    this.latencyStats = [this.srcLatencyStats, this.dstLatencyStats];
    this.throughputStats = [this.srcThroughputStats, this.dstThroughputStats];
    this.packetLossStats = [this.srcPacketLossStats, this.dstPacketLossStats];
    this.bufferSizeStats = [this.srcBufferSizeStats, this.dstBufferSizeStats];
  }

  private pushRawAndGetAvg(value: number, raw: number[]): number {
    raw.push(value);

    if (raw.length > AVG_LENGTH) {
      raw.shift();
    }

    return raw.reduce((last, next) => last + next, 0) / Math.max(raw.length, 1);
  }

  private updateSrcStats(): void {
    let now = Date.now();

    // Update latency
    let latencyAvg = this.srcLatencyData
      .reduce((last, next) => last + next, 0) / this.srcLatencyData.length / TIME_SLOWDOWN;

    if (isNaN(latencyAvg)) {
      latencyAvg = this.delay;
    }

    latencyAvg = this.pushRawAndGetAvg(latencyAvg, this.srcLatencyRaw);

    this.srcLatencyStats.push({
      time: now,
      value: latencyAvg
    });

    if (this.srcLatencyStats.length > MAX_STATS_LENGTH) {
      this.srcLatencyStats.shift();
    }

    this.srcLatencyData = [];

    // Update buffer size
    let bufferAvg = this.srcBufferData
      .reduce((last, next) => last + next, 0) / Math.max(this.srcBufferData.length, 1) / BYTES_IN_KB;

    bufferAvg = this.pushRawAndGetAvg(bufferAvg, this.srcBufferSizeRaw);

    this.srcBufferSizeStats.push({
      time: now,
      value: bufferAvg
    });

    this.srcBufferData = [];

    if (this.srcBufferSizeStats.length > MAX_STATS_LENGTH) {
      this.srcBufferSizeStats.shift();
    }

    // Update pakcet loss
    this.srcPacketLossStats.push({
      time: now,
      value: this.srcLostPktCounter
    });

    if (this.srcPacketLossStats.length > MAX_STATS_LENGTH) {
      this.srcPacketLossStats.shift()
    }

    this.srcLostPktCounter = 0;

    // Update throughput
    let throughput = this.srcThroughputCounter / Math.max(now - this.srcLastUpdated, 1) * TIME_SLOWDOWN / BPMS_PER_MBPS;
    let avg = this.pushRawAndGetAvg(throughput, this.srcThroughputRaw);

    this.srcThroughputStats.push({
      time: now,
      value: avg
    });

    if (this.srcThroughputStats.length > MAX_STATS_LENGTH) {
      this.srcThroughputStats.shift();
    }

    this.srcLastUpdated = now;
    this.srcThroughputCounter = 0;

    // Schedule a future updates
    this.srcStatsTimer = setTimeout(() => {
      this.updateSrcStats();
    }, STATS_UPDATE_INTERVAL);

    // Notify a redraw
    this.notifyStatsUpdate();
  }

  private updateDstStats(): void {
    let now = Date.now();

    // Update latency
    let latencyAvg = this.dstLatencyData
      .reduce((last, next) => last + next, 0) / this.dstLatencyData.length / TIME_SLOWDOWN;

    if (isNaN(latencyAvg)) {
      latencyAvg = this.delay;
    }

    latencyAvg = this.pushRawAndGetAvg(latencyAvg, this.dstLatencyRaw);

    this.dstLatencyStats.push({
      time: now,
      value: latencyAvg
    });

    if (this.dstLatencyStats.length > MAX_STATS_LENGTH) {
      this.dstLatencyStats.shift();
    }

    this.dstLatencyData = [];

    // Update buffer size
    let bufferAvg = this.dstBufferData
      .reduce((last, next) => last + next, 0) / Math.max(this.dstBufferData.length, 1) / BYTES_IN_KB;

    bufferAvg = this.pushRawAndGetAvg(bufferAvg, this.dstBufferSizeRaw);

    this.dstBufferSizeStats.push({
      time: now,
      value: bufferAvg
    });

    this.dstBufferData = [];

    if (this.dstBufferSizeStats.length > MAX_STATS_LENGTH) {
      this.dstBufferSizeStats.shift();
    }

    // Update pakcet loss
    this.dstPacketLossStats.push({
      time: now,
      value: this.dstLostPktCounter
    });

    if (this.dstPacketLossStats.length > MAX_STATS_LENGTH) {
      this.dstPacketLossStats.shift();
    }

    this.dstLostPktCounter = 0;

    // Update throughput
    let throughput = this.dstThroughputCounter / Math.max(now - this.dstLastUpdated, 1) * TIME_SLOWDOWN / BPMS_PER_MBPS;
    let avg = this.pushRawAndGetAvg(throughput, this.dstThroughputRaw);

    this.dstThroughputStats.push({
      time: now,
      value: avg
    });

    if (this.dstThroughputStats.length > MAX_STATS_LENGTH) {
      this.dstThroughputStats.shift();
    }

    this.dstLastUpdated = now;
    this.dstThroughputCounter = 0;

    // Schedule a future updates
    this.dstStatsTimer = setTimeout(() => {
      this.updateDstStats();
    }, STATS_UPDATE_INTERVAL);

    // Notify a redraw
    this.notifyStatsUpdate();
  }

  private sendFromSrcBuffer(): void {
    this.srcSending = true;

    if (this.srcBuffer.isEmpty()) {
      this.srcSending = false;

      return;
    }

    let packet = <Packet>this.srcBuffer.shift();

    this.srcBufferUsed = this.srcBufferUsed - packet.size;
    packet.markSent();

    this.srcNextTimer = setTimeout(() => {
      this.sendFromSrcBuffer();
    }, packet.size / (this.capacity * BYTES_PER_MBPS) * TIME_SLOWDOWN * 1000);

    if (Math.random() * 100 < this.lossRate) {
      this.srcLostPktCounter++;
      console.log(`Packet lost at ${this.id}`);

      return;
    }

    let sendingTime = this.delay + packet.size / (this.capacity * BYTES_PER_MBPS) * 1000;

    this.srcTransTimer = setTimeout(() => {
      packet.markReceived();
      this.srcLatencyData.push(packet.getTransTime());
      this.srcThroughputCounter = this.srcThroughputCounter + packet.size;

      setTimeout(() => {
        this.dst.receivePacket(packet, this);
      });
    }, Math.floor(sendingTime * TIME_SLOWDOWN));
  }

  private sendFromDstBuffer(): void {
    this.dstSending = true;

    if (this.dstBuffer.isEmpty()) {
      this.dstSending = false;

      return;
    }

    let packet = <Packet>this.dstBuffer.shift();

    this.dstBufferUsed = this.dstBufferUsed - packet.size;
    packet.markSent();

    this.dstNextTimer = setTimeout(()=>{
      this.sendFromDstBuffer();
    }, packet.size / (this.capacity * BYTES_PER_MBPS) * TIME_SLOWDOWN * 1000);

    if (Math.random() * 100 < this.lossRate) {
      this.dstLostPktCounter++;
      console.log(`Packet lost at ${this.id}`);

      return;
    }

    let sendingTime = this.delay + packet.size / (this.capacity * BYTES_PER_MBPS) * 1000;

    this.dstTransTimer = setTimeout(() => {
      packet.markReceived();
      this.dstLatencyData.push(packet.getTransTime());
      this.dstThroughputCounter = this.dstThroughputCounter + packet.size;

      setTimeout(() => {
        this.src.receivePacket(packet, this);
      });

    }, Math.floor(sendingTime * TIME_SLOWDOWN));
  }

  public cleanUp(): void {
    // Stop ongoing transmission
    clearTimeout(this.srcTransTimer);
    clearTimeout(this.dstTransTimer);
    clearTimeout(this.srcNextTimer);
    clearTimeout(this.dstNextTimer);
    clearTimeout(this.srcStatsTimer);
    clearTimeout(this.dstStatsTimer);
  }

  public updateMetric(metric: number): void {
    this.metric = metric;

    for (let node of [this.src, this.dst]) {
      if (isRouter(node)) {
        node.advertiseLsa(this);
      }
    }
  }
}
