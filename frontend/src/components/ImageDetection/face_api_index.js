import * as faceapi from 'face-api.js'

const MODEL_URL = '/models';

export const loadModels = async () => {
    await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])
}


export const detectFacesWithDescriptors = async (videoEl, options = {}) => {
    console.log("Calling detectFacesWithDescriptors")
    const detections = await faceapi
    .detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions(options))
    .withFaceLandmarks()
    .withFaceDescriptors();
    return detections;
};

export const averageFaceDescriptors = (descriptors) => {

    if (!descriptors.length) return new Float32Array(128).fill(0);
    console.log("getting sum and averaging")
    const sum = descriptors.reduce((acc, vec) => {
      return acc.map((val, i) => val + vec[i]);
    }, new Array(128).fill(0));
  
    return new Float32Array(sum.map(val => val / descriptors.length));
  };