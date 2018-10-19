import { CongestionControlAlg, Flow, FlowStatus } from './network-devices';
import { VEGAS_ALPHA, VEGAS_BETA, VEGAS_GAMMA, FAST_GAMMA } from './constants';

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
    } else if (flow.maxAckDup > 3 && flow.flowTatus === FlowStatus.FRFR) {
      flow.cwnd = flow.cwnd + 1;
    }
  }
}

export class Vegas extends Reno implements CongestionControlAlg {
  private isProbing: boolean = true;
  private lastToggleTime: number;

  constructor(public flow: Flow) {
    super(flow);
    this.lastToggleTime = Date.now();
  }

  protected handleSS(): void {
    let flow = this.flow;

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
  }

  protected handleFRFR(): void {
    let flow = this.flow;

    flow.cwnd = flow.ssthresh;
    flow.flowStatus = FlowStatus.CA;
  }

  public onReceiveNewAck(): void {
    let flow = this.flow;

    if (flow.flowStatus === FlowStatus.SS) {
      this.handleSS();
    } else if (flow.flowStatus === FlowStatus.FRFR) {
      this.handleFRFR();
    } else if (flow.flowStatus === FlowStatus.CA) {
      let diff = flow.cwnd/flow.getRTTMin() - flow.cwnd/flow.getRTT();

      if (diff < VEGAS_ALPHA) {
        flow.cwnd += 1 / flow.cwnd;
      } else if (diff > VEGAS_BETA) {
        flow.cwnd -= 1 / flow.cwnd;
      }
    }
  }

  public onReceiveDupAck(): void {
    super.onReceiveDupAck();
  }
}

export class FAST extends Vegas implements CongestionControlAlg {
  private lastUpdate: number;
  private onHold: boolean = true;
  private changeTarget: number;

  constructor(public flow: Flow) {
    super(flow);
    this.lastUpdated = Date.now();
  }

  public onReceiveNewAck(): void {
    let flow = this.flow;

    if (flow.flowStatus === FlowStatus.SS) {
      super.handleSS();
    } else if (flow.flowStatus === FlowStatus.FRFR) {
      super.handleFRFR();
    } else if (flow.flowStatus === FlowStatus.CA) {
      if (!this.onHold) {
        flow.cwnd += this.changeTarget / flow.cwnd;
      }

      if (Date.now() - this.lastUpdated > flow.getRTT()) {
        if (this.onHold) {
          let RTTMin = flow.getRTTMin();

          this.changeTarget = Math.min(flow.cwnd,
            FAST_GAMMA * ((RTTMin / flow.getRTT() - 1) * flow.cwnd + VEGAS_ALPHA * RTTMin));
        }

        this.lastUpdated = Date.now();
        this.onHold = !this.onHold;
      }
    }
  }

  public onReceiveDupAck(): void {
    super.onReceiveDupAck();
  }
}
