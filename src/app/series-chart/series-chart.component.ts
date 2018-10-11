import { Component, OnInit } from '@angular/core';
import { v1 } from 'uuid';
import * as d3 from 'd3';

const now = Date.now();
const MOCK = [[{
  time: now, value: 5
}, {
  time: now + 1, value: 10
}]];

const INERVAL = 10000;
const ANIMATION_DURATION = 300;
const INTERVAL_TO_SHOW = 100; // s

@Component({
  selector: 'app-series-chart',
  templateUrl: './series-chart.component.html',
  styleUrls: ['./series-chart.component.css']
})
export class SeriesChartComponent implements OnInit {

  private id: string;

  constructor() { }

  ngOnInit() {
    this.id = v1();
  }

  private draw(): void {
    let data = MOCK;
    let dataMax;
    let currentTime = Date.now();
    let svg = d3.select(`#${this.id}`);

    if (isNone(data)) {
      return;
    } else {
      for (let i = 0; i < data.length; i++) {
        if (isNone(data[i])) {
          return;
        }
      }

      dataMax = getMaxValue(data);
    }

    let computeXaxis = d3.scale.linear()
      .domain([0, INTERVAL])
      .range([0, this.xAxisLength]);
    let computeX = d3.time.scale()
      .domain([new Date(currentTime - this.get("timeSpan")), new Date(currentTime)])
      .range([0, this.get("xAxisLength")]);
    let computeY = d3.scale.linear()
      .domain([0, getNextTwoPower(yMin > dataMax ? yMin : dataMax)])
      .range([this.get("yAxisLength"), 0]);
    let xAxis = d3.svg.axis()
      .scale(computeXaxis)
      .orient("bottom")
      .ticks(this.get("xTicks"))
      .tickFormat(d => d + this.get("xLabelSuffix"));
    let yAxis = d3.svg.axis()
      .scale(computeY)
      .orient("left")
      .ticks(this.get("yTicks"))
      .tickFormat(d => this.setYFormat(d));

    if (svg.select(".axis.x").selectAll(".x-axis")[0].length < 1) {
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

    if (svg.select(".axis.y").selectAll(".y-axis")[0].length < 1) {
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
    let lineFunction = d3.svg.line().interpolate("basis")
      .defined(d => !isNaN(d.value))
      .x(d => computeX(d.time))
      .y(d => computeY(d.value));
    let lineColors = this.get("lineColors");
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
