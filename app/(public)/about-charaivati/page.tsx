import Link from "next/link";
import {
  ArrowRight,
  Globe,
  Heart,
  Lightbulb,
  Store,
  Users,
} from "lucide-react";

export default function AboutCharaivatiPage() {
  const values = [
    {
      icon: <Store size={28} />,
      title: "Create",
      desc: "Build stores for goods, services, courses, or initiatives that matter to you.",
      color: "from-violet-500/20 to-indigo-500/10",
      iconColor: "text-violet-600",
    },
    {
      icon: <Lightbulb size={28} />,
      title: "Monetize Passion",
      desc: "Turn your interests, knowledge, and skills into meaningful opportunities.",
      color: "from-amber-500/20 to-orange-500/10",
      iconColor: "text-amber-600",
    },
    {
      icon: <Users size={28} />,
      title: "Collaborate",
      desc: "Connect with people, communities, and changemakers around you.",
      color: "from-sky-500/20 to-cyan-500/10",
      iconColor: "text-sky-600",
    },
    {
      icon: <Heart size={28} />,
      title: "Make Impact",
      desc: "Support or launch initiatives and contribute to causes larger than yourself.",
      color: "from-pink-500/20 to-rose-500/10",
      iconColor: "text-pink-600",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#111827]">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-gray-100">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-100 via-white to-indigo-100 opacity-90" />

        <div className="absolute top-10 left-[-120px] w-80 h-80 bg-violet-300/20 blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-[-120px] w-80 h-80 bg-indigo-300/20 blur-3xl rounded-full" />

        <div className="relative max-w-6xl mx-auto px-6 py-24">
          <div className="inline-flex items-center gap-2 bg-violet-100 text-violet-700 px-4 py-2 rounded-full text-sm font-medium">
            🌍 About Charaivati
          </div>

          <h1 className="mt-8 text-5xl md:text-6xl font-black leading-[1.05] tracking-tight">
            A place where people
            <br />
            build, explore and grow
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-500">
              together.
            </span>
          </h1>

          <p className="mt-8 text-[18px] leading-8 text-gray-600 max-w-3xl">
            Charaivati is a platform for creators, builders, educators,
            businesses and communities. It helps people create stores, offer
            services, teach skills, start initiatives and discover what others
            are building around them.
          </p>

          <div className="flex flex-wrap gap-4 mt-10">
            <Link
              href="/app/home"
              className="px-7 py-4 rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-[0_10px_40px_rgba(99,102,241,0.35)] hover:scale-[1.02] transition-all"
            >
              Explore Charaivati
            </Link>

            <Link
              href="/app/initiatives"
              className="px-7 py-4 rounded-3xl bg-white border border-violet-200 text-violet-700 font-semibold hover:bg-violet-50 transition"
            >
              Create Your Initiative
            </Link>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-xl">
              <Globe size={38} />
            </div>

            <h2 className="mt-8 text-4xl font-black leading-tight">
              Why Charaivati exists
            </h2>

            <p className="mt-6 text-gray-600 text-lg leading-8">
              The internet made it easy to consume content, but difficult to
              discover real people, local talent, meaningful communities and
              purposeful work.
            </p>

            <p className="mt-5 text-gray-600 text-lg leading-8">
              Charaivati exists to help people turn ideas into action, passions
              into opportunities, and communities into living ecosystems of
              collaboration.
            </p>
          </div>

          <div className="relative">
            <div className="rounded-[36px] bg-gradient-to-br from-violet-50 to-white border border-violet-100 p-10 shadow-sm">
              <div className="flex flex-col gap-6">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                  <h3 className="font-bold text-xl">🌱 Build Something</h3>
                  <p className="mt-3 text-gray-600 leading-7">
                    Create stores, services, courses or public initiatives.
                  </p>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                  <h3 className="font-bold text-xl">🤝 Connect With People</h3>
                  <p className="mt-3 text-gray-600 leading-7">
                    Discover creators, seek help, collaborate and grow together.
                  </p>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                  <h3 className="font-bold text-xl">🚀 Make Real Impact</h3>
                  <p className="mt-3 text-gray-600 leading-7">
                    Start initiatives and contribute to causes that matter.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center">
          <h2 className="text-4xl font-black">
            What you can do on Charaivati
          </h2>

          <p className="mt-4 text-lg text-gray-500">
            A connected platform for ideas, people and opportunities.
          </p>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 mt-14">
          {values.map((item, index) => (
            <div
              key={index}
              className="bg-white rounded-[30px] border border-gray-100 p-8 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
            >
              <div
                className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center ${item.iconColor}`}
              >
                {item.icon}
              </div>

              <h3 className="mt-6 text-2xl font-bold">{item.title}</h3>

              <p className="mt-4 text-gray-600 leading-7">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-violet-600 to-indigo-600 text-white p-10 md:p-14">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 blur-3xl rounded-full" />

          <div className="relative flex flex-col lg:flex-row gap-10 items-center justify-between">
            <div className="max-w-2xl">
              <h2 className="text-4xl md:text-5xl font-black leading-tight">
                Your drive can shape your future.
              </h2>

              <p className="mt-6 text-white/80 text-lg leading-8">
                Whether you want to start a business, teach a skill, offer a
                service or launch an initiative, Charaivati gives you the space
                to begin.
              </p>

              <div className="flex flex-wrap gap-5 mt-8 text-sm text-white/80">
                <Link
                  href="/terms-of-service"
                  className="hover:text-white transition"
                >
                  Terms of Service
                </Link>

                <Link
                  href="/privacy-policy"
                  className="hover:text-white transition"
                >
                  Privacy Policy
                </Link>

                <Link
                  href="/security"
                  className="hover:text-white transition"
                >
                  Security
                </Link>
              </div>
            </div>

            <Link
              href="/app/home"
              className="inline-flex items-center gap-2 px-8 py-5 rounded-3xl bg-white text-violet-700 font-semibold hover:scale-[1.03] transition-all shadow-xl"
            >
              Get Started
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}