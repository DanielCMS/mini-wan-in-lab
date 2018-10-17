import { CongestionControlAlg, Flow, FlowStatus } from './network-devices';

export class Tahoe implements CongestionControlAlg {
  constructor(public flow: Flow) {}

  public onReceiveNewAck(): void {
    let flow = this.flow;

    if (flow.flowStatus === FlowStatus.CA) {
      flow.cwnd = flow.cwnd + 1 / flow.cwnd;
    }
  }

  public onReceiveDupAck(): void {
    let flow = this.flow;

    if (flow.maxAckDup === 3) {
      flow.cwnd = 1;
      flow.flowStatus = FlowStatus.SS;
    }
  }
}

export class Reno implements CongestionControlAlg {
  constructor(public flow: Flow) {}

  public onReceiveNewAck(): void {
    let flow = this.flow;

    if (flow.flowStatus === FlowStatus.FRFR) {
      flow.cwnd = flow.ssthresh;
      flow.flowStatus = FlowStatus.CA;
    } else if (flow.flowStatus === FlowStatus.CA) {
      flow.cwnd = flow.cwnd + 1 / flow.cwnd;
    }
  }

  public onReceiveDupAck(): void {
    let flow = this.flow;

    if (flow.maxAckDup === 3) {
      flow.cwnd = flow.ssthresh + 3;
      flow.flowStatus = FlowStatus.FRFR;
    } else if (flow.maxAckDup > 3) {
      flow.cwnd = flow.cwnd + 1;
    }
  }
}

export class Vegas implements CongestionControlAlg {
  constructor(public flow: Flow) {}
  public onReceiveNewAck(): void {}
  public onReceiveDupAck(): void {}
}

export class FAST implements CongestionControlAlg {
  constructor(public flow: Flow) {}
  public onReceiveNewAck(): void {}
  public onReceiveDupAck(): void {}
}
