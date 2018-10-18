import { CongestionControlAlg, Flow, FlowStatus } from './network-devices';
import { VEGAS_ALPHA, VEGAS_BETA, VEGAS_GAMMA } from './constants';

export class Tahoe implements CongestionControlAlg {
  constructor(public flow: Flow) {}

  public onReceiveNewAck(): void {
    let flow = this.flow;

    if (flow.flowStatus === FlowStatus.SS) {
      flow.cwnd++;

      if (flow.cwnd >= flow.ssthresh) {
        flow.flowStatus = FlowStatus.CA;
      }
    } else if (flow.flowStatus === FlowStatus.CA) {
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

    if (flow.flowStatus === FlowStatus.SS) {
      flow.cwnd++;

      if (flow.cwnd >= flow.ssthresh) {
        flow.flowStatus = FlowStatus.CA;
      }
    } else if (flow.flowStatus === FlowStatus.FRFR) {
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
  private isProbing: boolean = true;
  private lastToggleTime: number;

  constructor(public flow: Flow) {
    this.lastToggleTime = Date.now();
  }

  public onReceiveNewAck(): void {
    let flow = this.flow;

    if (flow.flowStatus === FlowStatus.SS) {
      if (Date.now() - this.lastToggleTime > flow.getRTT()) {
        this.lastToggleTime = Date.now();
        this.isProbing = !this.isProbing;
      }

      if (this.isProbing) {
        flow.cwnd++;
      }

      if (flow.cwnd >= flow.ssthresh || flow.cwnd/flow.getRTTMin() - flow.cwnd/flow.getRTT() > VEGAS_GAMMA) {
        flow.flowStatus = FlowStatus.CA;
      }

    } else if (flow.flowStatus === FlowStatus.FRFR) {
      flow.cwnd = flow.ssthresh;
      flow.flowStatus = FlowStatus.CA;
    } else if (flow.flowStatus === FlowStatus.CA) {
      if (flow.cwnd/flow.getRTTMin() - flow.cwnd/flow.getRTT() < VEGAS_ALPHA) {
        flow.cwnd += 1 / flow.cwnd;
      } else if (flow.cwnd/flow.getRTTMin() - flow.cwnd/flow.getRTT() > VEGAS_BETA) {
        flow.cwnd -= 1 / flow.cwnd;
      }
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

export class FAST implements CongestionControlAlg {
  constructor(public flow: Flow) {}
  public onReceiveNewAck(): void {}

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
