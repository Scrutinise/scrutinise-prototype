export default function RevolutHero() {
return (
<section className="w-full flex flex-col md:flex-row items-center justify-between px-10 py-24 gap-10 relative">


{/* TEXT SIDE */}
<div className="max-w-xl z-10">
<h1 className="text-5xl font-bold mb-6">Master legislation. Shape the nation</h1>
<h2 className="text-xl text-gray-300 mb-4">Turn any idea into Parliament-ready law in 5 stages...</h2>


<div className="flex gap-4 mt-8">
<button className="bg-white text-black px-6 py-3 rounded-md font-semibold text-sm">Get started</button>
<button className="border border-gray-700 px-6 py-3 rounded-md text-sm">Vote</button>
</div>
</div>


{/* VIDEO SIDE */}
<div className="relative w-full md:w-1/2 flex justify-end">
<video
src="/woman-in-library-by-candlelight.mp4"
autoPlay
loop
muted
playsInline
className="w-full h-auto object-cover video-mask-left rounded-xl"
/>
</div>


</section>
);
}