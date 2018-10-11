import { AfterViewInit, Directive, ElementRef, Input, NgZone, OnDestroy } from '@angular/core';
import { fromEvent, Subject } from "rxjs";
import { filter, switchMap, takeUntil, map } from "rxjs/operators";
import { Vector } from "./vector";

function clampX(x: number): number {
  return Math.max(Math.min(x, window.innerWidth), 0);
}
function clampY(y: number): number {
  return Math.max(Math.min(y, window.innerHeight), 0);
}

@Directive({
  selector: '[draggable]'
})
export class DraggableDirective implements AfterViewInit, OnDestroy {

  @Input() dragHandle: string;
  @Input() dragTarget: string;

  private target: HTMLElement;
  private handle: HTMLElement;
  private delta: Vector = { x: 0, y: 0 };
  private offset: Vector = { x: 0, y: 0 };

  private destroy$ = new Subject<void>();

  constructor(private el: ElementRef) {}

  public ngAfterViewInit(): void {
    this.handle = this.dragHandle ? document.querySelector(this.dragHandle) as HTMLElement : this.el.nativeElement;
    this.target = this.el.nativeElement as HTMLElement;
    this.setupEvents();
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
  }

  private setupEvents(): void {
    let mousedown$ = fromEvent(this.handle, 'mousedown');
    let mousemove$ = fromEvent(document, 'mousemove');
    let mouseup$ = fromEvent(document, 'mouseup');

    let mousedrag$ = mousedown$.pipe(
      filter((e: MouseEvent) => e.button === 0),
      switchMap((e: MouseEvent) => {
        let startX = clampX(e.clientX);
        let startY = clampX(e.clientY);

        return mousemove$.pipe(
          map((e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            this.delta = {
              x: clampX(e.clientX) - startX,
              y: clampY(e.clientY) - startY
            };
          }),
          takeUntil(mouseup$)
        );
      }),
      takeUntil(this.destroy$)
    );

    mousedrag$.subscribe(() => {
      if (this.delta.x === 0 && this.delta.y === 0) {
        return;
      }

      this.translate();
    });

    mouseup$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.offset.x += this.delta.x;
      this.offset.y += this.delta.y;
      this.delta = { x: 0, y: 0 };
    });
  }

  private translate(): void {
    requestAnimationFrame(() => {
      this.target.style.transform = `
        translate(${this.offset.x + this.delta.x}px,
                  ${this.offset.y + this.delta.y}px)
      `;
    });
  }
}
