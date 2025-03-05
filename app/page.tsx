"use client";

import { useState, useEffect, useRef } from "react";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { initializeApp } from "firebase/app";
import gsap from "gsap";
import Skeleton from "react-loading-skeleton"; // Skeleton loader

const firebaseConfig = {
  apiKey: "AIzaSyDG7qIrXuSeUzLXuo6n629MqBWdJv6FrEU",
  authDomain: "trouwerij-arjan-rianda.firebaseapp.com",
  projectId: "trouwerij-arjan-rianda",
  storageBucket: "trouwerij-arjan-rianda.firebasestorage.app",
  messagingSenderId: "541260868007",
  appId: "1:541260868007:web:c627bb8ac0803979f16e82",
  measurementId: "G-1ZGEGE1JP3",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

type Post = {
  id: string;
  username: string;
  caption: string;
  imageUrl: string;
  createdAt: Date;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [caption, setCaption] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isCheckingUser, setIsCheckingUser] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const postsRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setIsCheckingUser(true);

    // Fix: Define the setUser type properly
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user); // user can either be of type 'User' or 'null'
    });

    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const unsubscribePosts = onSnapshot(q, (snapshot) => {
      setIsLoadingPosts(false);

      // Map the snapshot docs to match the Post type
      setPosts(
        snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            username: data.username,
            caption: data.caption,
            imageUrl: data.imageUrl,
            createdAt: data.createdAt.toDate(), // Firestore timestamp to JavaScript Date
          };
        })
      );
    });

    setIsCheckingUser(false);
    return () => {
      unsubscribe();
      unsubscribePosts();
    };
  }, []);

  useEffect(() => {
    if (!isLoadingPosts && !isCheckingUser && postsRef.current) {
      // GSAP animation for when posts are loaded
      gsap.fromTo(
        postsRef.current.children,
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, stagger: 0.1, duration: 0.5 }
      );
    }

    // GSAP fade-in animation for all <h1> elements
    gsap.fromTo(
      "h1",
      { opacity: 0 }, // initial state
      { opacity: 1, duration: 1, stagger: 0.3 } // final state with stagger effect
    );
  }, [isLoadingPosts, isCheckingUser]);

  const handleLogin = async () => {
    setIsCheckingUser(true);
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    setIsCheckingUser(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleUpload = async () => {
    // Check if both capturedPhoto and image are null
    if (!capturedPhoto && !image) return;

    setIsUploading(true);

    // Ensure that fileToUpload is a File object
    const fileToUpload = capturedPhoto || image;

    // TypeScript knows that fileToUpload is a File object here, so it can access .name
    if (!fileToUpload) {
      setIsUploading(false);
      return;
    }

    const imageRef = ref(
      storage,
      `images/${(fileToUpload as File).name || "captured-photo"}`
    );
    await uploadBytes(imageRef, fileToUpload);
    const imageUrl = await getDownloadURL(imageRef);
    await addDoc(collection(db, "posts"), {
      username: user?.displayName,
      caption,
      imageUrl,
      createdAt: new Date(),
    });

    setCaption("");
    setImage(null);
    setImageUrl(null);
    setCapturedPhoto(null);
    setIsUploading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setCapturedPhoto(null);
      setImage(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  // Updated onClick handler
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const startCamera = () => {
    setIsTakingPhoto(true);
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        } else {
          console.error("videoRef is null");
        }
      })
      .catch((err) => {
        console.error("Error accessing camera: ", err);
      });
  };

  const capturePhoto = () => {
    const canvas = canvasRef.current as HTMLCanvasElement;
    const video = videoRef.current as HTMLVideoElement;

    // Check if both video and canvas are available
    if (!video || !canvas) {
      console.error("Video or Canvas reference is null.");
      return;
    }

    // Capture the photo from the video feed
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const photo = canvas.toDataURL("image/png");

    // Process the captured image data
    const byteString = atob(photo.split(",")[1]);
    const mimeString = photo.split(",")[0].split(":")[1].split(";")[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });

    setCapturedPhoto(blob);
    setIsTakingPhoto(false);

    // Stop the video tracks (type assertion)
    if (videoRef.current?.srcObject) {
      const mediaStream = videoRef.current.srcObject as MediaStream;
      mediaStream.getTracks().forEach((track) => track.stop());
    }
  };

  const colors = ["rgb(248 184 139 / 71%)"];

  return (
    <div className="w-full h-full m-auto flex items-center justify-center flex-col overflow-scroll max-w-4xl">
      <div
        className="w-screen h-screen fixed top-0 left-0 z-[-2] bg-cover bg-center"
        style={{ backgroundImage: "url('/background.jpg')" }}
      />
      <div className="w-screen h-screen fixed top-0 left-0 z-[-1] bg-black opacity-50 backdrop-blur-md"></div>

      {!user && !isCheckingUser && !isLoadingPosts && (
        <div className="h-screen m-auto flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold animate__animated animate__fadeIn">
            Bruiloft
          </h1>
          <h1 className="text-4xl animate__animated animate__fadeIn">
            Arjan & Rianda
          </h1>

          <button
            onClick={handleLogin}
            className="mt-4 px-4 py-2 rounded text-white bg-blue-500"
          >
            Inloggen met Google
          </button>
        </div>
      )}

      {user && !isLoadingPosts && !isCheckingUser && (
        <>
          <div className="h-fit flex flex-col items-center justify-center my-6">
            <h1 className="text-2xl font-bold">Bruiloft</h1>
            <h1 className="text-4xl">Arjan & Rianda</h1>
          </div>
          <div
            className="h-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 m-4"
            ref={postsRef}
          >
            <div
              className="w-full h-full post p-6 rounded-lg bg-white flex flex-col justify-between shadow-lg gap-4"
              style={{
                background: "rgba(178, 206, 254, 0.8)",
              }}
            >
              <div className="flex flex-col gap-2">
                <span className="text-xl font-bold text-center">
                  Upload jouw moment!
                </span>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Voeg titel toe (verplicht)"
                  className="border border-white p-2 rounded text-white"
                />

                <div className="flex gap-2 w-full align-center justify-center">
                  <button
                    onClick={startCamera}
                    className="p-2 rounded bg-green-500 text-white w-full"
                  >
                    Maak foto
                  </button>
                  <button
                    onClick={triggerFileInput}
                    className="p-2 rounded text-black bg-blue-500 text-white w-full"
                  >
                    Upload foto
                  </button>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="border p-2 rounded text-black hidden"
                />

                {imageUrl && !capturedPhoto && (
                  <div className="">
                    <img
                      src={imageUrl}
                      alt="Preview"
                      className="w-full rounded max-h-[200px]"
                    />
                  </div>
                )}

                {capturedPhoto && !imageUrl && (
                  <div className="">
                    <img
                      src={URL.createObjectURL(capturedPhoto)}
                      alt="Captured Photo"
                      className="w-full rounded"
                    />
                  </div>
                )}

                <button
                  onClick={handleUpload}
                  className={`bg-blue-500 p-2 rounded text-white ${
                    (!imageUrl && !capturedPhoto) || !caption || isUploading
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                  disabled={
                    (!imageUrl && !capturedPhoto) || !caption || isUploading
                  }
                >
                  {isUploading ? (
                    <Skeleton width={100} height={24} />
                  ) : (
                    "Upload bericht"
                  )}
                </button>
              </div>

              <button
                onClick={handleLogout}
                className="bg-red-500 p-2 rounded w-full"
              >
                Uitloggen
              </button>
            </div>

            {isLoadingPosts ? (
              <div className="col-span-full">
                <Skeleton height={200} />
                <Skeleton height={200} />
                <Skeleton height={200} />
              </div>
            ) : (
              posts.map((post) => (
                <div
                  key={post.id}
                  className="post shadow-lg p-6 rounded-lg h-fit"
                  style={{
                    backgroundColor:
                      colors[Math.floor(Math.random() * colors.length)],
                  }}
                >
                  <h1 className="text-xl font-bold text-white">
                    {post.username}
                  </h1>
                  <p className="mt-2 text-white opacity-80">{post.caption}</p>
                  <img
                    src={post.imageUrl}
                    alt="Post"
                    className="w-full mt-4 rounded-lg h-[200px] object-cover"
                    style={{ background: "rgba(0, 0, 0, 0.48)" }}
                  />
                </div>
              ))
            )}
          </div>
        </>
      )}

      {isTakingPhoto && (
        <div
          className="fixed h-full w-full flex items-center justify-center top-0"
          style={{ zIndex: 1000 }}
        >
          <div className="absolute top-0 left-0 w-full h-full bg-black opacity-50 z-[-1]" />
          <div className="flex flex-col items-center mx-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-lg mb-4"
            ></video>
            <canvas ref={canvasRef} className="hidden"></canvas>
            <button
              onClick={capturePhoto}
              className="bg-green-500 text-white px-6 py-3 rounded-lg font-semibold shadow-md"
            >
              Capture Photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
