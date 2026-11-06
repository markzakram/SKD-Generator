'use client';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';
import { VIDEO, slideAtFrame, type VideoProps } from '@/lib/video-plan';

// Preview and MP4 use exactly the same composition and prepared slides. Only supported
// browser-renderer primitives are animated; academic formatting lives in the slide images.
export default function ExplanationVideo({ project }: VideoProps) {
  const frame = useCurrentFrame(), slide = slideAtFrame(project.slides, frame);
  if (!slide) return <AbsoluteFill style={{ backgroundColor: '#f3f7fc' }}/>;
  const opacity = interpolate(frame - slide.from, [0, 8], [.3, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ backgroundColor: '#f3f7fc' }}>
    <Img src={slide.src} style={{ width: VIDEO.width, height: VIDEO.height, opacity }}/>
    <div style={{ position: 'absolute', bottom: 0, left: 0, height: 5, width: VIDEO.width * Math.min(1, (frame + 1) / project.durationInFrames), backgroundColor: '#146653' }}/>
  </AbsoluteFill>;
}
