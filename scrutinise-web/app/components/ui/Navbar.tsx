'use client';


export default function Navbar() {
return (
<nav className="w-full flex justify-between items-center px-10 py-4 bg-black text-white border-b border-gray-900">
<div className="text-xl font-semibold">Scrutinise</div>


<div className="hidden md:flex gap-8 text-gray-300 text-sm">
<button>Create</button>
<button>Vote</button>
<button>Training</button>
<button>Research</button>
<button>About</button>
</div>


<div className="flex gap-3">
<button className="px-4 py-2 text-gray-300">Log in</button>
<button className="px-4 py-2 bg-white text-black rounded-md font-medium">Sign up</button>
</div>
</nav>
);
}