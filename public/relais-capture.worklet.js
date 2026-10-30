// Relais de secours des appels (src/components/messagerie/audio/relais-secours.js) :
// remet le son du micro au fil principal, par blocs. Le fichier reste dans
// public/ : la CSP refuse les modules blob:, et un worklet n'a rien à importer.
/* global AudioWorkletProcessor, registerProcessor */
class RelaisCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bloc = new Float32Array(2048);
    this.rempli = 0;
  }

  process(entrees) {
    const voie = entrees[0]?.[0];
    if (voie) {
      this.bloc.set(voie, this.rempli);
      this.rempli += voie.length;
      if (this.rempli + voie.length > this.bloc.length) {
        this.port.postMessage(this.bloc.slice(0, this.rempli));
        this.rempli = 0;
      }
    }
    return true;
  }
}

registerProcessor("relais-capture", RelaisCapture);
