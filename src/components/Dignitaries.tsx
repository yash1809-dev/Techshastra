import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  fetchDignitariesBySection,
  DEFAULT_LEADERSHIP,
  DEFAULT_DIRECTORS,
  Dignitary,
} from "@/lib/services/dignitariesService";

const Dignitaries = () => {
  const [leadership, setLeadership] = useState<Dignitary[]>(DEFAULT_LEADERSHIP);
  const [directors, setDirectors] = useState<Dignitary[]>(DEFAULT_DIRECTORS);

  useEffect(() => {
    fetchDignitariesBySection("leadership").then((data) => {
      if (data.length > 0) setLeadership(data);
    });
    fetchDignitariesBySection("directors").then((data) => {
      if (data.length > 0) setDirectors(data);
    });
  }, []);

  return (
    <section className="py-24 px-4">
      <div className="container mx-auto max-w-5xl">
        {/* Governor / CM / VC */}
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl md:text-5xl font-heading font-light tracking-wider text-foreground">
            Esteemed Leadership
          </h2>
          <p className="text-sm font-light text-foreground/50 tracking-[0.2em] uppercase">
            Guided by Vision
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-16 sm:mb-20">
          {leadership.map(({ name, title, message, photo_url }) => (
            <Card key={name} className="glass border-0 overflow-hidden group shadow-xl text-center">
              <CardContent className="p-0 flex flex-col items-center">
                <div className="w-full h-56 sm:h-64 relative overflow-hidden">
                  <img
                    src={photo_url}
                    alt={name}
                    className="w-full h-full object-cover object-top transition-all duration-700 group-hover:scale-105"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        "https://placehold.co/400x300?text=No+Photo";
                    }}
                  />
                </div>
                <div className="p-5 sm:p-6 space-y-1">
                  <h3 className="text-base sm:text-lg font-heading font-normal tracking-wide text-foreground">
                    {name}
                  </h3>
                  <p className="text-primary text-xs font-normal tracking-[0.1em] uppercase">
                    {title}
                  </p>
                  {message && (
                    <p className="text-foreground/60 text-xs sm:text-sm italic mt-1">{message}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Directors */}
        <div className="text-center mb-10 sm:mb-12 space-y-3 sm:space-y-4">
          <h2 className="text-2xl md:text-4xl font-heading font-light tracking-wider text-foreground">
            Directors
          </h2>
          <p className="text-xs sm:text-sm font-light text-foreground/50 tracking-[0.2em] uppercase">
            University &amp; Affiliated Institutions
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {directors.map(({ name, title, institute, photo_url }) => (
            <Card
              key={name + (institute ?? "")}
              className="glass border-0 overflow-hidden group shadow-xl text-center flex flex-col"
            >
              <CardContent className="p-0 flex flex-col items-center h-full">
                <div className="w-full h-32 sm:h-36 relative overflow-hidden shrink-0">
                  <img
                    src={photo_url}
                    alt={name}
                    className="w-full h-full object-cover object-top transition-all duration-700 group-hover:scale-105"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        "https://placehold.co/300x300?text=No+Photo";
                    }}
                  />
                </div>
                <div className="p-2.5 sm:p-3 space-y-0.5 flex-1 flex flex-col justify-center">
                  <h3 className="text-xs font-heading font-normal tracking-wide text-foreground leading-snug line-clamp-2">
                    {name}
                  </h3>
                  <p className="text-primary text-[10px] font-normal tracking-[0.08em] uppercase">
                    {title}
                  </p>
                  {institute && (
                    <p className="text-foreground/55 text-[10px] line-clamp-1">{institute}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Dignitaries;
