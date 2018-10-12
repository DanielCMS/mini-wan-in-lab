import { Component, OnInit, Input } from '@angular/core';
import { SeriesPoint } from '../series-point';
import { v1 } from 'uuid';
import * as d3 from 'd3';

function getMaxValue(multiData: SeriesPoint[][]): number {
    let max = -Infinity;

    for (let j = 0; j < multiData.length; j++) {
        let data = multiData[j];

        if (data) {
            for (let i = 0; i < data.length; i++) {
                if (isFinite(data[i].value) && data[i].value > max) {
                    max = data[i].value;
                }
            }
        }
    }

    return max;
}

function getNextTwoPower(value: number): number {
    if (value <= 0 || !isFinite(value)) {
        return 1;
    }

    let p = 1;

    while (p <= value) {
        p = p * 2;
    }

    return p;
}

const now = Date.now();
const MOCK = [[{
  time: now + 1000, value: 5
}, {
  time: now + 5000, value: 10
}], [{
  time: now + 1000, value: 25
}, {
  time: now + 5000, value: 5

}]];

const INTERVAL = 100000; // 100s
const ANIMATION_DURATION = 300;
const X_TICKS = 5;
const Y_TICKS = 4;
const Y_LABEL_MARGIN = 25;
const LINE_COLORS = ["#00B4DC", "#CC0000"];
const STROKE_WIDTH = 2;

@Component({
  selector: 'app-series-chart',
  templateUrl: './series-chart.component.html',
  styleUrls: ['./series-chart.component.css']
})
export class SeriesChartComponent implements OnInit {

  private id: string;
  @Input() data: SeriesPoint[][];
  @Input() xAxisWidth: number;
  @Input() yAxisLength: number;

  private xAxisLength: number;
  private Y_LABEL_MARGIN: number = Y_LABEL_MARGIN;

  constructor() {
    // The prefix is needed to make it a valid id
    this.id = `id-${v1()}`;
  }

  ngOnInit() {
    this.xAxisLength = this.xAxisWidth - Y_LABEL_MARGIN;
    setTimeout(() => {
      this.draw();
    });
  }

  private draw(): void {
    let data = MOCK;
    let dataMax;
    let currentTime = Date.now();
    let svg = d3.select(`#${this.id}`);

    if (!data) {
      return;
    } else {
      dataMax = getMaxValue(data);
    }

    let computeXaxis = d3.scaleLinear()
      .domain([0, INTERVAL])
      .range([0, this.xAxisLength]);
    let computeX = d3.scaleTime()
      .domain([new Date(currentTime - INTERVAL), new Date(currentTime)])
      .range([0, this.xAxisLength]);
    let computeY = d3.scaleLinear()
      .domain([0, getNextTwoPower(dataMax)])
      .range([this.yAxisLength, 0]);
    let xAxis = d3.axisBottom()
      .scale(computeXaxis)
      .ticks(X_TICKS)
      .tickFormat(d3.timeFormat("%M:%S"));
    let yAxis = d3.axisLeft()
      .scale(computeY)
      .ticks(Y_TICKS)
      .tickFormat(d => d3.format(".2s")(d));

    let existingXAxis = svg.select(".axis.x").selectAll(".x-axis")["_groups"][0];
    let existingYAxis = svg.select(".axis.y").selectAll(".y-axis")["_groups"][0];

    if (!existingXAxis || !existingYAxis) {
      return;
    }

    if (existingXAxis.length < 1) {
      svg.select(".axis.x")
        .append("g")
        .attr("class", "x-axis axis-style")
        .call(xAxis);
    } else {
      svg.select(".x.axis")
        .selectAll(".x-axis")
        .transition().duration(ANIMATION_DURATION).ease("sin")
        .call(xAxis);
    }

    if (existingYAxis.length < 1) {
      svg.select(".axis.y")
        .append("g")
        .attr("class", "y-axis axis-style")
        .call(yAxis);
    } else {
      svg.select(".y.axis")
        .selectAll(".y-axis")
        .transition().duration(ANIMATION_DURATION).ease("sin")
        .call(yAxis);
    }

    let lineFunction = d3.line()
      .curve(d3.curveCardinal)
      .defined(d => !isNaN(d.value))
      .x(d => computeX(d.time))
      .y(d => computeY(d.value));
    let lineColors = LINE_COLORS;
    let computeColor = index => lineColors[index];
    let drawnLines = svg.select(".lines").selectAll("path.line").data(data);

    drawnLines.transition().duration(ANIMATION_DURATION);
    drawnLines
        .attr("d", (d, i) => lineFunction(data[i]));
    drawnLines.enter().append("path")
        .classed("line", true)
        .style("stroke", (d, i) => computeColor(i))
        .style("stroke-width", STROKE_WIDTH)
        .style("fill", 'none')
        .attr("d", (d, i) => lineFunction(data[i]));
    drawnLines.exit().remove();
  }
}