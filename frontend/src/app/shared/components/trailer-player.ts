/**
 * trailer-player.ts — plays a game trailer.
 * ---------------------------------------------------------------------------
 * Steam trailers are HLS streams (".m3u8" playlists split into small video
 * chunks). Only Safari plays HLS natively, so for other browsers we use the
 * hls.js library, which downloads the chunks and feeds them to a normal
 * <video> element.
 *
 * hls.js is imported DYNAMICALLY (`await import('hls.js')`), so its ~400KB
 * are downloaded only when a trailer is actually played, not on page load.
 * ---------------------------------------------------------------------------
 */
import { Component, ElementRef, effect, input, OnDestroy, viewChild } from '@angular/core';
import type Hls from 'hls.js';

@Component({
  selector: 'app-trailer-player',
  template: `
    <video #video controls playsinline [poster]="poster()" [attr.aria-label]="title()"></video>
  `,
  styles: `
    :host { display: block; background: #000; }
    video { width: 100%; height: 100%; display: block; background: #000; }
  `,
})
export class TrailerPlayer implements OnDestroy {
  readonly src = input.required<string>();
  readonly poster = input<string>('');
  readonly title = input<string>('Trailer');
  readonly autoplay = input(true);

  // viewChild() gives us a reference to the <video #video> element (as a signal).
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private hls: Hls | null = null;
  private loadId = 0; // detects when a newer trailer was requested meanwhile

  constructor() {
    // Re-runs whenever `src` changes (user clicks another trailer).
    effect(() => {
      const src = this.src();
      const video = this.video().nativeElement;
      this.load(video, src);
    });
  }

  private async load(video: HTMLVideoElement, src: string) {
    this.destroyHls(); // stop the previous stream, if any
    const currentLoad = ++this.loadId;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari (and some mobile browsers): native HLS support.
      video.src = src;
    } else {
      const { default: HlsLib } = await import('hls.js');
      // While we waited for the download, the user may have picked another trailer.
      if (currentLoad !== this.loadId || !HlsLib.isSupported()) return;
      this.hls = new HlsLib({ capLevelToPlayerSize: true }); // don't download 1080p into a small player
      this.hls.loadSource(src);
      this.hls.attachMedia(video);
    }

    if (this.autoplay()) {
      // Browsers only allow autoplay when muted (or after a user click).
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    }
  }

  private destroyHls() {
    this.hls?.destroy();
    this.hls = null;
  }

  // Lifecycle hook: called when the component is removed from the page.
  ngOnDestroy() {
    this.destroyHls();
  }
}
