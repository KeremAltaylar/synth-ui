/* global p5, userStartAudio */
import React, { useRef, useEffect, useState } from "react";

export default function SynthUI() {
  const canvasRef = useRef(null);
  const oscRef = useRef(null);
  const envRef = useRef(null);
  const reverbRef = useRef(null);
  const delayRef = useRef(null);
  const distortionRef = useRef(null);
  const fftRef = useRef(null);

  const [attack, setAttack] = useState(0.1);
  const [decay, setDecay] = useState(0.1);
  const [sustain, setSustain] = useState(0.1);
  const [release, setRelease] = useState(0.1);
  const [octave, setOctave] = useState(4);
  const [reverbTime, setReverbTime] = useState(0);
  const [delayTime, setDelayTime] = useState(0);
  const [delayFeedback, setDelayFeedback] = useState(0);
  const [delayFilter, setDelayFilter] = useState(2300);
  const [distortionAmount, setDistortionAmount] = useState(0);
  const [audioStarted, setAudioStarted] = useState(false);

  const rootFreq = 261.63;
  const scale = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8];
  const keys = "asdfghj";

  useEffect(() => {
    if (!audioStarted) return;

    const sketch = (p) => {
      p.setup = () => {
        p.createCanvas(600, 150).parent(canvasRef.current);

        envRef.current = new p5.Envelope();
        envRef.current.setADSR(attack, decay, sustain, release);
        envRef.current.setRange(0.5, 0);

        oscRef.current = new p5.Oscillator("sine");
        oscRef.current.amp(envRef.current);
        oscRef.current.start();

        delayRef.current = new p5.Delay();
        delayRef.current.process(oscRef.current, delayTime, delayFeedback, delayFilter);
        delayRef.current.amp(0.7);

        reverbRef.current = new p5.Reverb();
        reverbRef.current.process(oscRef.current, reverbTime, 2);
        reverbRef.current.process(delayRef.current, reverbTime, 2);
        reverbRef.current.amp(1);

        distortionRef.current = new p5.Distortion(distortionAmount);
        distortionRef.current.process(oscRef.current);
        distortionRef.current.process(reverbRef.current);
        distortionRef.current.process(delayRef.current);
        distortionRef.current.amp(0.2);

        fftRef.current = new p5.FFT();
        fftRef.current.setInput(oscRef.current);
        fftRef.current.setInput(delayRef.current);
        fftRef.current.setInput(reverbRef.current);
        fftRef.current.setInput(distortionRef.current);

      };

      p.draw = () => {
        p.background(30);
        const halfWidth = p.width / 2;

        const waveform = fftRef.current.waveform();
        p.stroke(255);
        p.noFill();
        p.beginShape();
        for (let i = 0; i < waveform.length; i++) {
          const x = p.map(i, 0, waveform.length, 0, halfWidth - 40);
          const y = p.map(waveform[i], -1, 1, 0, p.height);
          p.vertex(x, y);
        }
        p.endShape();

        const spectrum = fftRef.current.analyze();
        p.noStroke();
        p.fill("#f5ef71");
        for (let i = 0; i < spectrum.length; i++) {
          const x = p.map(i, 0, spectrum.length, halfWidth + 40, p.width);
          const h = -p.height + p.map(spectrum[i], 0, 255, p.height, 0);
          p.rect(x, p.height+ p.height/10, p.width / spectrum.length, h);
        }
      };
    };

    const myp5 = new p5(sketch);
    return () => myp5.remove();
  }, [audioStarted]);

  useEffect(() => {
    if (envRef.current) {
      envRef.current.setADSR(attack, decay, sustain, release);
    }
  }, [attack, decay, sustain, release]);

  useEffect(() => {
    if (delayRef.current) {
      delayRef.current.delayTime(delayTime);
      delayRef.current.feedback(delayFeedback);
      delayRef.current.filter(delayFilter);
    }
  }, [delayTime, delayFeedback, delayFilter]);

  useEffect(() => {
    if (reverbRef.current) {
      reverbRef.current.set(reverbTime, 2);
    }
  }, [reverbTime]);

  useEffect(() => {
    if (distortionRef.current) {
      distortionRef.current.set(distortionAmount);
      if (distortionAmount === 0) {
        distortionRef.current.disconnect();
      } else {
        distortionRef.current.process(oscRef.current);
      }
    }
  }, [distortionAmount]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const index = keys.indexOf(e.key);
      if (index !== -1 && oscRef.current && envRef.current) {
        const freq = rootFreq * scale[index] * Math.pow(2, octave - 4);
        oscRef.current.freq(freq);
        envRef.current.play();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [octave]);

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6 text-white bg-black min-h-screen">
      <h1 className="text-2xl font-bold text-yellow-300">Simple Synth</h1>

      {!audioStarted && (
        <button
          className="bg-green-500 text-black px-4 py-2 rounded"
          onClick={() => {
            p5.prototype.userStartAudio();
            setAudioStarted(true);
          }}
        >
          Start Audio
        </button>
      )}

      <div ref={canvasRef} className="border border-yellow-400 rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <label>Attack<input type="range" min="0.01" max="1" step="0.01" value={attack} onChange={(e) => setAttack(+e.target.value)} /></label>
        <label>Decay<input type="range" min="0.01" max="1" step="0.01" value={decay} onChange={(e) => setDecay(+e.target.value)} /></label>
        <label>Sustain<input type="range" min="0.01" max="1" step="0.01" value={sustain} onChange={(e) => setSustain(+e.target.value)} /></label>
        <label>Release<input type="range" min="0.01" max="1" step="0.01" value={release} onChange={(e) => setRelease(+e.target.value)} /></label>
        <label>Reverb Time<input type="range" min="0" max="10" step="0.1" value={reverbTime} onChange={(e) => setReverbTime(+e.target.value)} /></label>
        <label>Delay Time<input type="range" min="0" max="1" step="0.01" value={delayTime} onChange={(e) => setDelayTime(+e.target.value)} /></label>
        <label>Delay Feedback<input type="range" min="0" max="0.99" step="0.01" value={delayFeedback} onChange={(e) => setDelayFeedback(+e.target.value)} /></label>
        <label>Delay Filter<input type="range" min="100" max="10000" step="10" value={delayFilter} onChange={(e) => setDelayFilter(+e.target.value)} /></label>
        <label>Distortion<input type="range" min="0.0" max="0.9" step="0.01" value={distortionAmount} onChange={(e) => setDistortionAmount(+e.target.value)} /></label>
      </div>
      <div className="space-x-4 mt-4">
        <button className="bg-yellow-300 text-black px-3 py-1 rounded" onClick={() => setOctave(o => o - 1)}>Octave Down</button>
        <button className="bg-yellow-300 text-black px-3 py-1 rounded" onClick={() => setOctave(o => o + 1)}>Octave Up</button>
        <span className="text-yellow-300">Current Octave: {octave}</span>
      </div>
    </div>
  );
}
