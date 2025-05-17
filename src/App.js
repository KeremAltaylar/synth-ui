import React from "react";
import SynthUI from "./components/SynthUI";

function App() {
  return (
    <div className="bg-black text-white min-h-screen">
      <h1 className="text-center text-3xl font-bold py-6">🎛 Browser Synth</h1>
      <SynthUI />
    </div>
  );
}

export default App;