import { Component, OnChanges, SimpleChanges, OnInit, Input } from '@angular/core';
import { SeriesPoint } from '../series-point';
import { v4 } from 'uuid';
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

function getMinTime(multiData: SeriesPoint[][]): number {
    let min = Infinity;

    for (let j = 0; j < multiData.length; j++) {
        let data = multiData[j];

        for (let i = 0; i < data.length; i++) {
            if (isFinite(data[i].time) && data[i].time < min) {
                min = data[i].time;
            }
        }
    }

    return min;
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
export class SeriesChartComponent implements OnInit, OnChanges {

  private id: string;
  @Input() data: SeriesPoint[][];
  @Input() xAxisWidth: number;
  @Input() yAxisLength: number;

  private xAxisLength: number;
  private Y_LABEL_MARGIN: number = Y_LABEL_MARGIN;

  constructor() {
    // The prefix is needed to make it a valid id
    this.id = `id-${v4()}`;
  }

  ngOnInit() {
    this.xAxisLength = this.xAxisWidth - Y_LABEL_MARGIN;
    setTimeout(() => {
      this.draw();
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    // Reset tmp device during link adding if canvas status changed
    for (let propName in changes) {
      if (propName === "data") {
        this.draw();
      }
    }
  }

  private draw(): void {
    let data = this.data;
    let dataMax;
    let currentTime = Date.now();
    let startingTime = Math.max(getMinTime(data), currentTime - INTERVAL);
    let endingTime = startingTime + INTERVAL;
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
      .domain([new Date(startingTime), new Date(endingTime)])
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
        .transition().duration(ANIMATION_DURATION).ease(d3.easeSin)
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
        .transition().duration(ANIMATION_DURATION).ease(d3.easeSin)
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
