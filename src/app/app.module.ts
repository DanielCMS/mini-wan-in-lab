import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { LogoComponent } from './logo/logo.component';
import { CanvasComponent } from './canvas/canvas.component';
import { RouterPanelComponent } from './router-panel/router-panel.component';
import { HostPanelComponent } from './host-panel/host-panel.component';
import { LinkPanelComponent } from './link-panel/link-panel.component';
import { FlowPanelComponent } from './flow-panel/flow-panel.component';
import { DraggableDirective } from './draggable.directive';
import { ControlsComponent } from './controls/controls.component';
import { NetworkStructureComponent } from './network-structure/network-structure.component';
import { PanelsComponent } from './panels/panels.component';
import { InputComponent } from './input/input.component';
import { SeriesChartComponent } from './series-chart/series-chart.component';

@NgModule({
  declarations: [
    AppComponent,
    LogoComponent,
    CanvasComponent,
    RouterPanelComponent,
    HostPanelComponent,
    LinkPanelComponent,
    FlowPanelComponent,
    DraggableDirective,
    ControlsComponent,
    NetworkStructureComponent,
    PanelsComponent,
    InputComponent,
    SeriesChartComponent
  ],
  imports: [
    BrowserModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
