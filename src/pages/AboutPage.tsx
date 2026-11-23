import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, Eye, Cpu, Rocket, Heart, Users, Calendar, Award } from "lucide-react";
import logoFull from "@/assets/logo-full.png";
import { fetchLeaders, DEFAULT_LEADERS, Leader } from "@/lib/services/leadersService";

const AboutPage = () => {
    const [leaders, setLeaders] = useState<Leader[]>(DEFAULT_LEADERS);

    useEffect(() => {
      fetchLeaders().then((data) => {
        if (data.length > 0) setLeaders(data);
      });
    }, []);

    const containerVariants = {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: 0.2
        }
      }
    };

    const itemVariants = {
      hidden: { opacity: 0, y: 20 },
      visible: { 
        opacity: 1, 
        y: 0,
        transition: { duration: 0.8, ease: "easeOut" as any }
      }
    };

    return (
      <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
        <Navbar />

        <main className="pt-24 pb-20 px-4">
          <div className="container mx-auto max-w-6xl">
            
            {/* Hero Section */}
            <section className="py-20 text-center space-y-8 overflow-hidden">
              <motion.div
                initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1, 
                  rotate: 0,
                  y: [-10, 10]
                }}
                transition={{ 
                  opacity: { duration: 1 },
                  scale: { duration: 1 },
                  rotate: { duration: 1 },
                  y: {
                    repeat: Infinity,
                    repeatType: "reverse",
                    duration: 4,
                    ease: "easeInOut"
                  }
                }}
                className="relative inline-block mb-8"
              >
                <div className="absolute -inset-10 bg-primary/20 blur-[100px] rounded-full -z-10 animate-soft-pulse"></div>
                <img src={logoFull} alt="TECHSHASTRA Logo" className="w-48 h-48 mx-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.3)] filter contrast-125" />
              </motion.div>
              
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-6 max-w-3xl mx-auto"
              >
                <motion.div variants={itemVariants}>
                  <Badge variant="outline" className="px-6 py-2 border-primary/20 bg-primary/5 text-primary tracking-[0.3em] uppercase text-[10px] font-bold">
                    Since 2023 • UTU Dehradun
                  </Badge>
                </motion.div>
                
                <motion.h1 
                  variants={itemVariants}
                  className="text-4xl sm:text-6xl md:text-8xl font-bold tracking-tight leading-[1] sm:leading-[0.9]"
                >
                  Architecting the <br />
                  <span className="text-primary italic relative inline-block">
                    Innovation Core
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ delay: 1, duration: 1 }}
                      className="absolute bottom-1 sm:bottom-2 left-0 h-1 bg-primary/30 -z-10" 
                    />
                  </span>
                </motion.h1>
                
                <motion.p 
                  variants={itemVariants}
                  className="text-xl text-muted-foreground font-light leading-relaxed max-w-2xl mx-auto"
                >
                  Empowering the next generation of engineers, researchers, and entrepreneurs through 
                  high-octane technical excellence.
                </motion.p>
              </motion.div>
            </section>

          {/* Mission & Vision */}
          <section className="py-16 sm:py-24 grid md:grid-cols-2 gap-8 sm:gap-12">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
            >
              <Card className="glass border-0 h-full p-6 sm:p-10 space-y-6 sm:space-y-8 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 overflow-hidden group">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500">
                  <Target className="w-8 h-8" />
                </div>
                <div className="space-y-4">
                  <h2 className="text-4xl font-bold italic">Our Mission</h2>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    To provide a dynamic, research-oriented ecosystem where students can transition 
                    from conventional learners to industry-ready innovators. We focus on bridging the gap 
                    between academic theoretical knowledge and high-stakes real-world engineering challenges.
                  </p>
                </div>
                <ul className="space-y-4">
                  {["Nurture Technical Talent", "Promote Open-Source Culture", "Incubate Startups", "Facilitate Industry Connect"].map((item, idx) => (
                    <motion.li 
                      key={idx} 
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + (idx * 0.1) }}
                      className="flex items-center gap-4 text-sm text-foreground/70"
                    >
                      <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                      {item}
                    </motion.li>
                  ))}
                </ul>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
            >
              <Card className="glass border-0 h-full p-6 sm:p-10 space-y-6 sm:space-y-8 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 group overflow-hidden">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:bg-accent group-hover:text-accent-foreground transition-all duration-500">
                  <Eye className="w-8 h-8" />
                </div>
                <div className="space-y-4">
                  <h2 className="text-4xl font-bold italic">Our Vision</h2>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    To emerge as Uttarakhand's premier technical hub, recognized globally for producing 
                    top-tier technical talent and innovative solutions. We envision a future where 
                    TECHSHASTRA alumni lead major engineering breakthroughs and entrepreneurial ventures 
                    across the globe.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-6 pt-4">
                  {[
                    { val: "500+", lab: "Members" },
                    { val: "15+", lab: "Domains" }
                  ].map((stat, idx) => (
                    <motion.div 
                      key={idx}
                      whileHover={{ y: -5 }}
                      className="p-4 sm:p-6 rounded-3xl bg-muted/30 border border-foreground/5 text-center group-hover:border-primary/20 transition-all"
                    >
                      <p className="text-2xl sm:text-3xl font-bold text-primary">{stat.val}</p>
                      <p className="text-[8px] sm:text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mt-1">{stat.lab}</p>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </section>

          {/* History / Timeline */}
          <section className="py-24 space-y-16">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="text-center space-y-4"
            >
              <h2 className="text-5xl font-bold italic tracking-tight">Our <span className="text-primary">Journey</span></h2>
              <p className="text-muted-foreground text-lg">A legacy of growth and technical persistence.</p>
            </motion.div>

            <div className="relative">
              {/* Central Vertical Line with Scroll Growth */}
              <motion.div 
                initial={{ height: 0 }}
                whileInView={{ height: "100%" }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                className="absolute left-4 md:left-1/2 top-0 w-px bg-gradient-to-b from-primary/5 via-primary/40 to-primary/5 md:-translate-x-px" 
              />

              <div className="space-y-12">
                {[
                  { year: "2023", title: "The Inception", desc: "TECHSHASTRA was born in the technical halls of UTU Dehradun with a handful of pioneers." },
                  { year: "2024", title: "Scaling Up", desc: "Expanded to 15+ specialized domains including AI, IoT, and Cyber Security." },
                  { year: "2025", title: "Regional Dominance", desc: "Secured top positions in state-level hackathons and technical symposiums." }
                ].map((step, idx) => (
                  <div key={idx} className="relative">
                    {/* Dot on Line */}
                    <motion.div 
                      initial={{ scale: 0, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.5 + (idx * 0.2) }}
                      className="absolute left-4 md:left-1/2 top-8 w-4 h-4 rounded-full bg-primary -translate-x-1/2 border-4 border-background z-10 shadow-[0_0_15px_rgba(var(--primary),0.6)]" 
                    />
                    
                    <motion.div 
                      initial={{ opacity: 0, x: idx % 2 === 0 ? -100 : 100 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      transition={{ duration: 0.8, delay: idx * 0.2, ease: "easeOut" }}
                      className={`relative pl-10 md:pl-0 md:w-1/2 ${idx % 2 === 0 ? "md:pr-16 md:text-right ml-0" : "md:pl-16 md:ml-auto text-left"}`}
                    >
                      <div className="bg-muted/20 backdrop-blur-sm p-6 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] border border-white/5 hover:border-primary/40 transition-all duration-500 group overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-20 transition-opacity duration-700 group-hover:rotate-12 group-hover:scale-125">
                          <Calendar className="w-20 h-20" />
                        </div>
                        <span className="text-primary font-bold text-2xl tracking-tighter inline-block mb-2 group-hover:translate-x-2 transition-transform duration-500">{step.year}</span>
                        <h3 className="text-2xl font-extrabold mt-1 tracking-tight group-hover:text-primary transition-colors">{step.title}</h3>
                        <p className="text-sm text-muted-foreground mt-4 leading-relaxed font-light">{step.desc}</p>
                      </div>
                    </motion.div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Mentorship & Leadership */}
          <section className="py-16 sm:py-24 space-y-12 sm:space-y-16">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center space-y-4"
            >
              <h2 className="text-3xl sm:text-5xl font-bold italic">Mentorship & Leadership</h2>
              <p className="text-base sm:text-lg text-muted-foreground">Guided by expertise, driven by community.</p>
            </motion.div>

            <motion.div 
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="grid md:grid-cols-3 gap-8"
            >
              {leaders.map((leader, idx) => (
                <motion.div key={idx} variants={itemVariants}>
                  <Card className="glass border-0 overflow-hidden group h-full">
                    <CardHeader className="p-0 h-96 bg-muted relative overflow-hidden">
                      <motion.img 
                        whileHover={{ scale: 1.1 }}
                        transition={{ duration: 0.6 }}
                        src={leader.photo_url || "https://placehold.co/400x600?text=No+Photo"} 
                        alt={leader.name} 
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
                    </CardHeader>
                    <CardContent className="p-6 sm:p-10 text-center space-y-4 relative -mt-16 sm:-mt-20 bg-card/40 backdrop-blur-xl mx-4 sm:mx-6 rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 shadow-2xl group-hover:-translate-y-2 transition-transform duration-500">
                      <div className="space-y-1">
                        <h3 className="text-2xl font-bold">{leader.name}</h3>
                        <p className="text-primary text-[10px] font-bold uppercase tracking-[0.3em]">{leader.role}</p>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed italic">{leader.bio}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </section>

          {/* CTA */}
          <section className="py-24">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <Card className="bg-primary/5 border border-primary/20 p-8 sm:p-16 text-center rounded-[2.5rem] sm:rounded-[4rem] space-y-8 sm:space-y-10 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-30 -z-10" />
                <div className="space-y-4">
                  <h2 className="text-3xl sm:text-6xl font-bold italic tracking-tighter leading-tight">Be Part of the <span className="text-primary">Legacy</span></h2>
                  <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
                    Join 500+ innovators who are pushing the boundaries of what's possible. 
                    Your journey towards technical dominance starts here.
                  </p>
                </div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button size="lg" className="rounded-full px-16 h-16 text-lg bg-primary text-primary-foreground shadow-[0_20px_50px_rgba(var(--primary),0.3)] hover:shadow-primary/40 transition-all" asChild>
                    <a href="/join">Initialize Your Journey</a>
                  </Button>
                </motion.div>
              </Card>
            </motion.div>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AboutPage;
