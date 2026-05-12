import React, { useState, useEffect } from "react";
import { Trophy, Shield, Ghost, Flame, Target, Skull, Crosshair, Crown } from "lucide-react";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContext";

// Types for the Ranking system
export type PlayerRank = "Fantasma" | "Iniciado" | "Estrategista" | "Mestre da Lábia" | "Prime";

interface Player {
  id: string;
  name: string;
  rank: PlayerRank;
  score: number; // Notoriedade (XP)
  level: number;
  cards: string[];
  infractions: string[];
  isCurrentUser?: boolean;
}

export const RANK_INFO = {
  "Prime": { color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/50", icon: Crown },
  "Mestre da Lábia": { color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/50", icon: Flame },
  "Estrategista": { color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/50", icon: Crosshair },
  "Iniciado": { color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/50", icon: Shield },
  "Fantasma": { color: "text-gray-400", bg: "bg-gray-400/10", border: "border-gray-400/50", icon: Ghost },
};

const CARDS_INFO: Record<string, { desc: string, icon: any }> = {
  "Lábia de Ouro": { desc: "Gera respostas de alto impacto.", icon: Flame },
  "Visão de Raio-X": { desc: "Lê entrelinhas e Red Flags com precisão.", icon: Target },
  "Ousadia Extrema": { desc: "Testes de valor bem-sucedidos.", icon: Crosshair },
  "Frio e Calculista": { desc: "Reações frias que geraram interesse.", icon: Shield },
};

const INFRACTIONS_INFO: Record<string, { desc: string, icon: any }> = {
  "Gado Detectado": { desc: "Validou demais sem receber nada em troca.", icon: Skull },
  "Textão": { desc: "Punição por enviar mensagens desproporcionais.", icon: Skull },
  "Emocionado (Leve)": { desc: "Demonstrou interesse muito rápido.", icon: Skull },
  "Emocionado (Grave)": { desc: "Interrogatório longo ou insistência.", icon: Skull },
};

export function getRankByXP(xp: number): PlayerRank {
  if (xp >= 5000) return "Prime";
  if (xp >= 2500) return "Mestre da Lábia";
  if (xp >= 1000) return "Estrategista";
  if (xp >= 200) return "Iniciado";
  return "Fantasma";
}

export default function RankingView() {
  const [activeTab, setActiveTab] = useState<"ranking" | "regras">("ranking");
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    async function loadRanking() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("users")
          .select("userID, name, email, xp, level")
          .order("xp", { ascending: false, nullsFirst: false });

        if (error) throw error;
        
        if (data) {
          const players: Player[] = data.map((u) => ({
            id: u.userID,
            name: u.name || (u.email ? u.email.split('@')[0] : "Anônimo"),
            rank: getRankByXP(u.xp || 0),
            score: u.xp || 0,
            level: u.level || 1,
            cards: [],
            infractions: [],
            isCurrentUser: user?.id === u.userID
          }));
          setLeaderboard(players);
        }
      } catch (err) {
        console.error("Erro ao carregar o ranking:", err);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadRanking();
  }, [user]);

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="p-6 border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="w-8 h-8 text-gold-glow" />
          <h2 className="text-2xl font-black text-white uppercase tracking-wider">
            Notoriedade NALÁBIA
          </h2>
        </div>
        <p className="text-sm text-gray-400 mt-1">
          Onde a hierarquia social é medida em resultados frios. Suba de rank ou seja devorado pelo jogo.
        </p>

        <div className="flex gap-4 mt-6">
          <button
            onClick={() => setActiveTab("ranking")}
            className={`pb-2 px-1 font-bold text-sm tracking-widest uppercase transition-all border-b-2 ${
              activeTab === "ranking"
                ? "border-gold-glow text-gold-glow"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            Leaderboard
          </button>
          <button
            onClick={() => setActiveTab("regras")}
            className={`pb-2 px-1 font-bold text-sm tracking-widest uppercase transition-all border-b-2 ${
              activeTab === "regras"
                ? "border-gold-glow text-gold-glow"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            Cartas & Infrações
          </button>
        </div>
      </div>

      <div className="p-6 overflow-y-auto pb-32">
        {activeTab === "ranking" && (
          <div className="space-y-8">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-glow"></div>
              </div>
            ) : (
              <>
                {/* TOP 10 */}
                <section>
                  <h3 className="text-white font-black text-lg uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-gold-glow" />
                    Top 10 Globais
                  </h3>
                  <div className="space-y-4">
                    {leaderboard.slice(0, 10).map((player, index) => {
                      const info = RANK_INFO[player.rank];
                      const Icon = info.icon;
                      
                      return (
                        <div 
                          key={player.id}
                          className={`relative p-4 rounded-xl border ${player.isCurrentUser ? 'bg-white/10 border-gold-glow/50' : 'bg-black/50 border-white/5'} overflow-hidden transition-all hover:border-white/20`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              {/* Position */}
                              <div className={`text-2xl font-black ${index < 3 ? 'text-gold-glow' : 'text-gray-600'}`}>
                                #{index + 1}
                              </div>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`font-bold text-lg ${player.isCurrentUser ? 'text-white' : 'text-gray-200'}`}>
                                    {player.name}
                                  </span>
                                  {player.isCurrentUser && (
                                    <span className="text-[10px] bg-gold-glow/20 text-gold-glow px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                                      Você
                                    </span>
                                  )}
                                </div>
                                
                                <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest mt-1 ${info.color}`}>
                                  <Icon className="w-3.5 h-3.5" />
                                  {player.rank}
                                  <span className="text-gray-500 ml-1">Lvl {player.level}</span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-xl font-black text-white tracking-widest">
                                {player.score.toLocaleString()} XP
                              </div>
                              <div className="text-[10px] text-gray-500 uppercase tracking-widest">
                                Notoriedade
                              </div>
                            </div>
                          </div>

                          {/* Cards and Infractions */}
                          {(player.cards.length > 0 || player.infractions.length > 0) && (
                            <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-2">
                              {player.cards.map((card, idx) => (
                                <div key={`card-${idx}`} className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-1 rounded text-[10px] uppercase font-bold text-gray-300">
                                  <Flame className="w-3 h-3 text-gold-glow" />
                                  {card}
                                </div>
                              ))}
                              {player.infractions.map((inf, idx) => (
                                <div key={`inf-${idx}`} className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded text-[10px] uppercase font-bold text-red-400">
                                  <Skull className="w-3 h-3" />
                                  {inf}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Rest of Players */}
                {leaderboard.length > 10 && (
                  <section>
                    <h3 className="text-gray-400 font-bold text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
                      Outros Jogadores
                    </h3>
                    <div className="space-y-3">
                      {leaderboard.slice(10).map((player, index) => {
                        const info = RANK_INFO[player.rank];
                        const Icon = info.icon;
                        const actualRank = index + 11;
                        
                        return (
                          <div 
                            key={player.id}
                            className={`p-3 rounded-xl border ${player.isCurrentUser ? 'bg-white/5 border-gold-glow/30' : 'bg-black/30 border-white/5'} overflow-hidden`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {/* Position */}
                                <div className="text-lg font-bold text-gray-700 w-8">
                                  #{actualRank}
                                </div>

                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className={`font-semibold ${player.isCurrentUser ? 'text-white' : 'text-gray-300'}`}>
                                      {player.name}
                                    </span>
                                    {player.isCurrentUser && (
                                      <span className="text-[9px] bg-gold-glow/20 text-gold-glow px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
                                        Você
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-lg font-bold text-gray-300">
                                  {player.score.toLocaleString()} XP
                                </div>
                                <div className={`flex items-center justify-end gap-1 text-[10px] font-bold uppercase ${info.color}`}>
                                  <Icon className="w-3 h-3" />
                                  {player.rank}
                                  <span className="text-gray-500 ml-1">Lvl {player.level}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "regras" && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
            {/* Hierarquia */}
            <section>
              <h3 className="text-white font-black text-lg uppercase tracking-widest mb-4 flex items-center gap-2">
                <Crown className="w-5 h-5 text-gold-glow" />
                Hierarquia (Ranks)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(RANK_INFO).map(([rank, info]) => {
                  const Icon = info.icon;
                  return (
                    <div key={rank} className={`p-4 rounded-xl border ${info.bg} ${info.border}`}>
                      <div className={`flex items-center gap-2 font-bold uppercase tracking-widest ${info.color}`}>
                        <Icon className="w-4 h-4" />
                        {rank}
                      </div>
                      <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                        Desbloqueado ao atingir marcos de notoriedade XP usando a IA e quebrando padrões no jogo do texto.
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Vantagens */}
            <section>
              <h3 className="text-white font-black text-lg uppercase tracking-widest mb-4 flex items-center gap-2">
                <Flame className="w-5 h-5 text-gold-glow" />
                Cartas de Poder
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(CARDS_INFO).map(([card, info]) => {
                  const Icon = info.icon;
                  return (
                    <div key={card} className="p-4 rounded-xl border border-white/5 bg-black/50">
                      <div className="flex items-center gap-2 font-bold text-white uppercase tracking-widest text-sm">
                        <Icon className="w-4 h-4 text-emerald-400" />
                        {card}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">{info.desc}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Punições */}
            <section>
              <h3 className="text-red-500 font-black text-lg uppercase tracking-widest mb-4 flex items-center gap-2">
                <Skull className="w-5 h-5" />
                Infrações (Punições)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(INFRACTIONS_INFO).map(([infraction, info]) => {
                  const Icon = info.icon;
                  return (
                    <div key={infraction} className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                      <div className="flex items-center gap-2 font-bold text-red-500 uppercase tracking-widest text-sm">
                        <Icon className="w-4 h-4" />
                        {infraction}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">{info.desc}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
