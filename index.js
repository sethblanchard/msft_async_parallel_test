const sdk = require("microsoft-cognitiveservices-speech-sdk");
const fs = require('fs-extra');


const generateSsml = (voice, pitch, text) => 
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
        <voice name="${voice}">
            <break time="500" />    
            <prosody pitch="${pitch}">${text}</prosody>
            <break time="500" />    
        </voice>
    </speak>`;

const textToSpeechSameSynth = (synth, text, id) => {
    return new Promise((resolve, reject) => {
        synth.speakSsmlAsync(
          text,
          (data) => {
            console.log(`${id} TTS complete`)
            resolve(data);
          },
          (err) => {
            console.error(`${id} TTS has an error:  ${err}`);
            reject(err);
          });
        })
}

(async ()=>{


    const msftSubscriptionKey = process.env["MSFT_KEY"];
    const msftLocation = process.env["MSFT_LOCATION"];

    let cnt = [...Array(25).keys()];
    const voice = "en-US-AriaNeural";
    const pitch = "-5%";
    try {
        let hrstart = process.hrtime();

        const speechConfig = sdk.SpeechConfig.fromSubscription(
            msftSubscriptionKey,
            msftLocation
          );
        speechConfig.speechSynthesisOutputFormat =
        sdk.SpeechSynthesisOutputFormat.Audio16Khz128KBitRateMonoMp3;
    
        let synth = new sdk.SpeechSynthesizer(speechConfig, null);

        console.log('Attempting 25 batch calls ')
        let allMp3s = await Promise.all(cnt.map(async id => {
            try {
                let ssml = generateSsml(voice, pitch, 
                    `This is item ${id} and it should quickly return a result and shouldn't break the synth. It also needs to be long enough that maybe there is a time difference in returning them? This probably isn't long enough but isn't terrible.`)
                const data = await textToSpeechSameSynth(synth, ssml, id);
                let hrItemEnd = process.hrtime(hrstart);
                console.info('%s results execution time: %ds %dms', id, hrItemEnd[0], hrItemEnd[1] / 1000000)
                return data;
            } catch (error) {
                console.error(`${id} had a rare error`)
                console.error(error)
            }
        }))    

        synth.close();
        synth = undefined;

        let allFiles = await Promise.all(allMp3s.map(async (audioData, id) => {
            try {
                const audioBuffer = Buffer.from(audioData.privAudioData);
                return await fs.writeFile(`sameSynth/${id}.mp3`, audioBuffer)
            } catch (error) {
                console.error(`${id} had an error writing audio the file`)    
                console.log(error);
            }

        }))

        console.log(`${allFiles.length} mp3s  writtten to disk`)

        let hrFullTime = process.hrtime(hrstart)
        console.info('Total single synth execution in: %ds %dms',  hrFullTime[0], hrFullTime[1] / 1000000)

        process.exit();

    } catch (error) {
        console.error(error)
    }
    

})();