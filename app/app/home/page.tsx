"use client";

import Link from "next/link";
import {
  Heart,
  Search,
  Users,
  Briefcase,
  GraduationCap,
  Store,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export default function HomePage() {
  const features = [
    {
      icon: <Store size={28} />,
      title: "Create Your Store",
      desc: "Sell goods, services, courses, or anything you're passionate about.",
      color: "from-violet-500/20 to-indigo-500/10",
      iconColor: "text-violet-600",
    },
    {
      icon: <Briefcase size={28} />,
      title: "Monetize Your Passion",
      desc: "Turn your skills and ideas into meaningful income.",
      color: "from-green-500/20 to-emerald-500/10",
      iconColor: "text-green-600",
    },
    {
      icon: <Search size={28} />,
      title: "Explore & Discover",
      desc: "Find amazing stores, services, courses, and initiatives around you.",
      color: "from-sky-500/20 to-cyan-500/10",
      iconColor: "text-sky-600",
    },
    {
      icon: <Heart size={28} />,
      title: "Join Initiatives",
      desc: "Support causes, participate in initiatives and make a real impact.",
      color: "from-pink-500/20 to-rose-500/10",
      iconColor: "text-pink-600",
    },
    {
      icon: <Users size={28} />,
      title: "Collaborate",
      desc: "Connect with experts, seek help, and build together.",
      color: "from-orange-500/20 to-amber-500/10",
      iconColor: "text-orange-600",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#111827] overflow-hidden pb-28">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-100 via-white to-indigo-100 opacity-90" />

        <div className="absolute top-20 left-[-120px] w-72 h-72 bg-violet-300/20 blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-[-100px] w-72 h-72 bg-indigo-300/20 blur-3xl rounded-full" />

        <div className="relative px-6 pt-10 pb-16 max-w-7xl mx-auto">
          {/* Main Hero */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div>
              <div className="inline-flex items-center gap-2 bg-violet-100 text-violet-700 px-4 py-2 rounded-full text-sm font-medium">
                ✦ Build. Share. Impact.
              </div>

              <h1 className="mt-6 text-5xl md:text-6xl font-black leading-[1.05] tracking-tight text-[#111827]">
                Find your{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-500">
                  Drive.
                </span>
                <br />
                Build your{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-500">
                  Space.
                </span>
              </h1>

              <p className="mt-6 text-[18px] leading-8 text-gray-600 max-w-xl">
                Create stores for goods, services, courses or initiatives.
                Explore amazing stores, get help and join causes that matter.
              </p>

              {/* CTA */}
              <div className="flex flex-wrap gap-4 mt-10">
                <Link
                  href="/app/saved"
                  className="group px-7 py-4 rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-[0_10px_40px_rgba(99,102,241,0.35)] flex items-center gap-2 hover:scale-[1.02] transition-all"
                >
                  Explore Stores
                  <ArrowRight
                    size={18}
                    className="group-hover:translate-x-1 transition"
                  />
                </Link>

                <Link
                  href="/app/initiatives"
                  className="px-7 py-4 rounded-3xl bg-white/80 backdrop-blur border border-violet-200 text-violet-700 font-semibold hover:bg-violet-50 transition"
                >
                  Your Initiatives
                </Link>
              </div>

              {/* Community */}
              <div className="flex items-center gap-4 mt-10">
                <div className="flex -space-x-3">
                  {["A", "R", "K"].map((letter, i) => (
                    <div
                      key={i}
                      className="w-11 h-11 rounded-full border-2 border-white bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shadow"
                    >
                      {letter}
                    </div>
                  ))}

                  <div className="w-11 h-11 rounded-full bg-black border-2 border-white flex items-center justify-center text-white text-sm font-semibold">
                    1K+
                  </div>
                </div>

                <p className="text-sm text-gray-600 leading-6">
                  Creators, builders and changemakers trust Charaivati
                </p>
              </div>
            </div>

            {/* Right Graphic */}
            <div className="relative hidden lg:flex justify-center items-center min-h-[500px]">
              <div className="absolute w-[420px] h-[420px] rounded-full border border-dashed border-violet-300 animate-spin [animation-duration:40s]" />

              <div className="absolute w-[260px] h-[260px] rounded-full bg-gradient-to-br from-violet-100 to-white shadow-2xl flex items-center justify-center text-7xl">
                🌱
              </div>

              {/* Floating cards */}
              <div className="absolute top-4 left-32 bg-white shadow-xl rounded-3xl p-5 w-40">
                <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center text-violet-600">
                  <Store />
                </div>

                <h3 className="mt-4 font-bold text-lg">Goods</h3>
              </div>

              <div className="absolute top-40 left-0 bg-white shadow-xl rounded-3xl p-5 w-40">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
                  <Briefcase />
                </div>

                <h3 className="mt-4 font-bold text-lg">Services</h3>
              </div>

              <div className="absolute top-40 right-0 bg-white shadow-xl rounded-3xl p-5 w-40">
                <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center text-green-600">
                  <GraduationCap />
                </div>

                <h3 className="mt-4 font-bold text-lg">Courses</h3>
              </div>

              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white shadow-xl rounded-3xl p-5 w-40">
                <div className="w-12 h-12 rounded-2xl bg-pink-100 flex items-center justify-center text-pink-600">
                  <Heart />
                </div>

                <h3 className="mt-4 font-bold text-lg">Initiatives</h3>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-14 max-w-7xl mx-auto">
        <div className="text-center">
          <h2 className="text-3xl font-black tracking-tight">
            All you need to grow and make impact
          </h2>

          <p className="mt-3 text-gray-500 text-lg">
            Create. Explore. Collaborate. Monetize.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5 mt-12">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white rounded-[28px] p-7 border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
            >
              <div
                className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center ${feature.iconColor}`}
              >
                {feature.icon}
              </div>

              <h3 className="mt-6 text-2xl font-bold leading-tight">
                {feature.title}
              </h3>

              <p className="mt-4 text-gray-500 leading-7">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Banner */}
      <section className="px-6 max-w-7xl mx-auto">
        <div className="relative overflow-hidden rounded-[36px] border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-10">
          <div className="absolute top-0 right-0 w-80 h-80 bg-violet-300/20 blur-3xl rounded-full" />

          <div className="relative flex flex-col lg:flex-row gap-10 items-center justify-between">
            <div className="max-w-2xl">
              <div className="w-16 h-16 rounded-3xl bg-violet-100 flex items-center justify-center text-violet-600">
                <ShieldCheck size={30} />
              </div>

              <h2 className="mt-6 text-4xl font-black leading-tight">
                Your passion can change your life.
                <br />
                Your initiative can change the world.
              </h2>

              <p className="mt-5 text-gray-600 text-lg leading-8">
                Charaivati helps creators, educators, builders and communities
                grow together through a connected digital ecosystem.
              </p>

              <div className="flex flex-wrap gap-5 mt-8 text-sm text-gray-500">
                <Link
                  href="/about-charaivati"
                  className="text-violet-600 font-semibold hover:underline"
                >
                  Learn more →
                </Link>

                <Link
                  href="/terms-of-service"
                  className="hover:text-black transition"
                >
                  Terms of Service
                </Link>

                <Link
                  href="/privacy-policy"
                  className="hover:text-black transition"
                >
                  Privacy Policy
                </Link>

                <Link
                  href="/security"
                  className="hover:text-black transition"
                >
                  Security
                </Link>
              </div>
            </div>

            <div>
              <Link
                href="/app/initiatives"
                className="inline-flex items-center gap-2 px-8 py-5 rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-[0_10px_40px_rgba(99,102,241,0.35)] hover:scale-[1.03] transition-all"
              >
                Get Started Now
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}