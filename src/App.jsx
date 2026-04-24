import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, Sparkles, AlertCircle, ExternalLink, Calendar, Euro, MapPin, Building2, CheckCircle2, Clock, X, Loader2, TrendingUp, FileText, Target, Key, Trash2, Download, RefreshCw } from "lucide-react";

// ============ THÉMATIQUES DE RECHERCHE ============
// Chaque vague = une requête IA séparée, pour maximiser la couverture
const VAGUES_RECHERCHE = [
  { label: "Éducation & décrochage scolaire", query: "éducation, prévention du décrochage scolaire, réussite éducative, soutien scolaire, enseignement professionnel, lycées professionnels" },
  { label: "Jeunesse & égalité des chances", query: "jeunesse, égalité des chances, mentorat, ouverture sociale, mobilité sociale, jeunes des quartiers populaires" },
  { label: "Insertion & emploi", query: "insertion professionnelle, accès à l'emploi, jeunes NEET, formation professionnelle, orientation, découverte des métiers" },
  { label: "Politique de la Ville & QPV", query: "politique de la ville, quartiers prioritaires (QPV), cités éducatives, cohésion sociale territoriale" },
  { label: "Démocratie & citoyenneté", query: "éducation à la citoyenneté, engagement des jeunes, démocratie participative, co-construction" },
  { label: "Fondations d'entreprise & mécénat", query: "fondations d'entreprise, mécénat, RSE, soutien associations éducation jeunesse" },
  { label: "Outre-mer & Guadeloupe", query: "appels à projets Guadeloupe, Outre-mer, éducation jeunesse emploi Antilles" },
  { label: "Europe (FSE+, Erasmus+)", query: "FSE+, fonds social européen, Erasmus+, programmes européens jeunesse éducation" },
];

// Wrapper compatible Claude.ai (window.storage) et navigateur (localStorage)
const storage = (typeof window !== 'undefined' && window.storage) ? window.storage : {
  get: async (key) => {
    const v = localStorage.getItem(key);
    return v !== null ? { key, value: v } : null;
  },
  set: async (key, value) => {
    localStorage.setItem(key, value);
    return { key, value };
  },
  delete: async (key) => {
    localStorage.removeItem(key);
    return { key, deleted: true };
  },
};

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [apiKeyValidated, setApiKeyValidated] = useState(false);
  const [inputKey, setInputKey] = useState("");

  const [aaps, setAaps] = useState([]);
  const [statuts, setStatuts] = useState({});
  const [conseils, setConseils] = useState({});
  const [filters, setFilters] = useState({ secteur: "Tous", type: "Tous", territoire: "Tous", recherche: "" });
  const [selectedAAP, setSelectedAAP] = useState(null);
  const [loadingConseil, setLoadingConseil] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [progressCount, setProgressCount] = useState({ trouves: 0, vague: 0, total: VAGUES_RECHERCHE.length });
  const [view, setView] = useState("tous");
  const [lastUpdate, setLastUpdate] = useState(null);
  const cancelRef = useRef(false);

  // ============ CHARGEMENT INITIAL ============
  useEffect(() => {
    (async () => {
      try {
        const k = await storage.get("uvpt_api_key");
        if (k?.value) { setApiKey(k.value); setApiKeyValidated(true); }
      } catch (e) {}
      try {
        const a = await storage.get("uvpt_aaps");
        if (a?.value) setAaps(JSON.parse(a.value));
      } catch (e) {}
      try {
        const s = await storage.get("uvpt_statuts");
        if (s?.value) setStatuts(JSON.parse(s.value));
      } catch (e) {}
      try {
        const c = await storage.get("uvpt_conseils");
        if (c?.value) setConseils(JSON.parse(c.value));
      } catch (e) {}
      try {
        const l = await storage.get("uvpt_last_update");
        if (l?.value) setLastUpdate(l.value);
      } catch (e) {}
    })();
  }, []);

  // ============ SAUVEGARDE CLÉ API ============
  const validerCleAPI = async () => {
    if (!inputKey.startsWith("sk-ant-")) {
      alert("La clé API Anthropic doit commencer par « sk-ant- ».");
      return;
    }
    try {
      await storage.set("uvpt_api_key", inputKey);
      setApiKey(inputKey);
      setApiKeyValidated(true);
      setInputKey("");
    } catch (e) { alert("Erreur lors de l'enregistrement : " + e.message); }
  };

  const supprimerCleAPI = async () => {
    if (!confirm("Supprimer la clé API ? Vous devrez la ressaisir.")) return;
    try { await storage.delete("uvpt_api_key"); } catch (e) {}
    setApiKey(""); setApiKeyValidated(false);
  };

  const updateStatut = async (aapId, nouveauStatut) => {
    const nouveaux = { ...statuts, [aapId]: nouveauStatut };
    setStatuts(nouveaux);
    try { await storage.set("uvpt_statuts", JSON.stringify(nouveaux)); } catch (e) {}
  };

  const joursRestants = (dateStr) => {
    if (!dateStr) return 999;
    const diff = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
    return Math.ceil(diff);
  };

  // ============ FILTRAGE ============
  const aapsFiltres = useMemo(() => {
    return aaps.filter((a) => {
      if (filters.secteur !== "Tous" && !(a.secteurs || []).includes(filters.secteur)) return false;
      if (filters.type !== "Tous" && a.type !== filters.type) return false;
      if (filters.territoire !== "Tous" && !(a.territoire || "").includes(filters.territoire)) return false;
      if (filters.recherche && !((a.titre || "") + (a.organisme || "") + (a.description || "")).toLowerCase().includes(filters.recherche.toLowerCase())) return false;
      if (view === "urgent") { const j = joursRestants(a.dateCloture); return j >= 0 && j <= 30; }
      if (view === "afaire") return (statuts[a.id] || "afaire") === "afaire";
      if (view === "encours") return statuts[a.id] === "encours";
      if (view === "soumis") return statuts[a.id] === "soumis";
      return true;
    }).sort((a, b) => new Date(a.dateCloture || "2099-12-31") - new Date(b.dateCloture || "2099-12-31"));
  }, [aaps, filters, statuts, view]);

  const secteurs = useMemo(() => ["Tous", ...new Set(aaps.flatMap(a => a.secteurs || []))], [aaps]);
  const types = useMemo(() => ["Tous", ...new Set(aaps.map(a => a.type).filter(Boolean))], [aaps]);
  const territoires = ["Tous", "National", "Île-de-France", "Hauts-de-Seine", "Guadeloupe", "QPV", "Outre-mer", "Européen"];

  const stats = useMemo(() => ({
    total: aaps.length,
    urgent: aaps.filter(a => { const j = joursRestants(a.dateCloture); return j >= 0 && j <= 30; }).length,
    encours: Object.values(statuts).filter(s => s === "encours").length,
    soumis: Object.values(statuts).filter(s => s === "soumis").length,
  }), [aaps, statuts]);

  // ============ RECHERCHE IA ILLIMITÉE ============
  const actualiserViaIA = async () => {
    if (!apiKey) { alert("Veuillez saisir votre clé API Anthropic."); return; }
    cancelRef.current = false;
    setRefreshing(true);
    setProgressCount({ trouves: 0, vague: 0, total: VAGUES_RECHERCHE.length });

    const tousNouveaux = [];
    const idsExistants = new Set(aaps.map(a => a.id));
    const today = new Date().toISOString().split('T')[0];

    for (let i = 0; i < VAGUES_RECHERCHE.length; i++) {
      if (cancelRef.current) break;
      const vague = VAGUES_RECHERCHE[i];
      setProgressCount(p => ({ ...p, vague: i + 1 }));
      setProgressMsg(`Vague ${i + 1}/${VAGUES_RECHERCHE.length} : ${vague.label}…`);

      try {
        const titresConnus = [...aaps, ...tousNouveaux].map(a => a.titre).slice(0, 40).join(" | ");

        const prompt = `Tu es expert en veille sur les appels à projets pour associations françaises. Tu cherches pour "Une Voie Pour Tous" (UVPT), association française qui valorise l'enseignement professionnel (lycées pro), avec programmes Les Pro'metteurs et Les Boussoles.

MISSION : Cherche via web_search TOUS les appels à projets ACTIFS ou à venir sur la thématique : ${vague.query}.

CRITÈRES STRICTS :
- Date de clôture postérieure au ${today} (AAP encore candidatables)
- Territoires acceptés : France métropolitaine + Guadeloupe (exclure les autres DROM sauf si AAP national)
- Tous types : fondations d'entreprise, fondations familiales, fondations RUP, mécénat, appels publics (ANCT, Cités Éducatives, Politique Ville, régions, préfectures, FSE+, Erasmus+, ADEME, CAF, CNAF, etc.)
- Cherche de façon exhaustive : AUCUNE LIMITE, trouve le maximum d'AAP réels et vérifiés (viser 15-30 par vague si possible)

EXCLUS ces AAP déjà connus : ${titresConnus || "(aucun)"}.

Réponds UNIQUEMENT avec un JSON valide (pas de markdown, pas de backticks, pas de texte autour), tableau d'objets avec cette structure EXACTE :
[{"id":"slug-court-unique-kebab-case","titre":"Titre officiel complet","organisme":"Nom complet du financeur","type":"Fondation d'entreprise|Fondation familiale|Fondation RUP|Public – État|Public – Collectivité|Public – Européen|Mécénat","secteurs":["Éducation","Jeunesse","Emploi","etc."],"territoire":"National|Île-de-France|Hauts-de-Seine|Guadeloupe|QPV|etc.","montantMin":5000,"montantMax":50000,"dateOuverture":"YYYY-MM-DD","dateCloture":"YYYY-MM-DD","url":"https://url-officielle-candidature","description":"Description précise 2 phrases max","pertinence":"Très élevée|Élevée|Moyenne","conditions":"Conditions éligibilité précises"}]

Si une date est inconnue, mets null. Priorise les URL officielles exactes de candidature. Si montant non public, mets 0.
RÉPONSE = JSON PUR UNIQUEMENT.`;

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 8000,
            messages: [{ role: "user", content: prompt }],
            tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
          }),
        });

        if (!response.ok) {
          const err = await response.text();
          throw new Error(`API ${response.status} : ${err.slice(0, 200)}`);
        }

        const data = await response.json();
        const texte = data.content
          .filter(b => b.type === "text")
          .map(b => b.text)
          .join("\n");

        const jsonMatch = texte.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const trouves = JSON.parse(jsonMatch[0]);
            const filtres = trouves.filter(a => a.id && a.titre && !idsExistants.has(a.id) && !tousNouveaux.some(n => n.id === a.id));
            filtres.forEach(f => { f._vague = vague.label; f._nouveau = true; });
            tousNouveaux.push(...filtres);
            setProgressCount(p => ({ ...p, trouves: tousNouveaux.length, vague: i + 1 }));
            // Mise à jour live de la liste
            setAaps(prev => [...filtres, ...prev]);
            await storage.set("uvpt_aaps", JSON.stringify([...tousNouveaux, ...aaps]));
          } catch (e) {
            console.warn(`Vague ${vague.label} : JSON invalide`, e);
          }
        }
      } catch (err) {
        console.error(`Vague ${vague.label} :`, err);
        setProgressMsg(`Erreur vague "${vague.label}" : ${err.message}. Passage à la suivante…`);
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    const maintenant = new Date().toLocaleString("fr-FR");
    setLastUpdate(maintenant);
    try { await storage.set("uvpt_last_update", maintenant); } catch (e) {}
    setProgressMsg(`✓ Recherche terminée : ${tousNouveaux.length} nouvel(le)s AAP ajouté(s).`);
    setRefreshing(false);
    setTimeout(() => setProgressMsg(""), 5000);
  };

  const annulerRecherche = () => { cancelRef.current = true; };

  const viderBase = async () => {
    if (!confirm("Supprimer tous les AAP et conseils ? (les statuts seront conservés)")) return;
    setAaps([]); setConseils({});
    try {
      await storage.set("uvpt_aaps", JSON.stringify([]));
      await storage.set("uvpt_conseils", JSON.stringify({}));
    } catch (e) {}
  };

  // ============ FICHE CONSEIL IA ============
  const genererConseil = async (aap) => {
    if (conseils[aap.id]) { setSelectedAAP(aap); return; }
    setSelectedAAP(aap);
    setLoadingConseil(true);
    try {
      const prompt = `Tu es consultant senior en levée de fonds pour associations. Produis une fiche conseil stratégique pour la candidature de "Une Voie Pour Tous" (UVPT) à cet AAP.

CONTEXTE UVPT : Association loi 1901 basée à Bagneux (92), mobilisée pour la valorisation de l'enseignement professionnel. Programmes : Les Pro'metteurs (accompagnement lycéens pro vers réussite et insertion), Les Boussoles (aide à l'orientation). Actions : plaidoyer, co-construction de politiques publiques, événements (Les Pros d'Or au Panthéon), accompagnement de jeunes en lycée pro notamment en QPV et Guadeloupe.

AAP À ANALYSER :
- Titre : ${aap.titre}
- Organisme : ${aap.organisme}
- Type : ${aap.type}
- Secteurs : ${(aap.secteurs || []).join(", ")}
- Territoire : ${aap.territoire}
- Montant : ${aap.montantMin}€ – ${aap.montantMax}€
- Clôture : ${aap.dateCloture}
- Description : ${aap.description}
- Conditions : ${aap.conditions}
- URL : ${aap.url}

Cherche via web_search des infos à jour sur l'organisme financeur : ADN, stratégie philanthropique, projets soutenus récemment, montants moyens alloués, critères implicites, décideurs clés.

Réponds en JSON PUR (pas de markdown) :
{
  "analyseFinanceur": "3-4 phrases précises sur l'ADN du financeur, sa ligne, ce qu'il finance concrètement",
  "adequation": "Très forte|Forte|Moyenne|Faible",
  "argumentsAdequation": ["arg1 précis et concret", "arg2", "arg3", "arg4"],
  "risquesAdequation": ["risque concret 1", "risque 2"],
  "projetsSuggeres": [
    {"nom":"Nom projet", "pitch":"Pitch 2 phrases concrètes", "budgetIndicatif":"X €", "angleDifferenciant":"Ce qui le rend unique pour CE financeur"}
  ],
  "strategieCandidature": "Recommandations précises sur l'angle, le storytelling, les éléments clés à mettre en avant",
  "pointsVigilance": ["point 1", "point 2", "point 3"],
  "checklistDossier": ["élément 1", "élément 2", "élément 3", "élément 4"],
  "contactsCles": "Qui contacter ou comment approcher (si info publique)"
}

Sois précis, actionnable, zéro généralité. Réponse = JSON pur uniquement.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{ role: "user", content: prompt }],
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        }),
      });

      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      const texte = data.content.filter(b => b.type === "text").map(b => b.text).join("\n");
      const jsonMatch = texte.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Pas de JSON trouvé dans la réponse");
      const conseil = JSON.parse(jsonMatch[0]);

      const nouveaux = { ...conseils, [aap.id]: conseil };
      setConseils(nouveaux);
      await storage.set("uvpt_conseils", JSON.stringify(nouveaux));
    } catch (err) {
      console.error(err);
      setConseils({ ...conseils, [aap.id]: { erreur: err.message } });
    }
    setLoadingConseil(false);
  };

  // ============ EXPORT CSV ============
  const exporterCSV = () => {
    const rows = [["Titre", "Organisme", "Type", "Secteurs", "Territoire", "Montant min", "Montant max", "Ouverture", "Clôture", "Pertinence", "Statut", "URL"]];
    aaps.forEach(a => rows.push([
      a.titre, a.organisme, a.type, (a.secteurs || []).join(" / "), a.territoire,
      a.montantMin, a.montantMax, a.dateOuverture || "", a.dateCloture || "",
      a.pertinence, statuts[a.id] || "afaire", a.url
    ]));
    const csv = rows.map(r => r.map(c => `"${String(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `uvpt_veille_aap_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============ ÉCRAN SAISIE CLÉ API ============
  if (!apiKeyValidated) {
    return (
      <div style={baseStyles.container}>
        <GlobalStyles />
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
          <div style={{ maxWidth: 560, width: "100%", background: "white", borderRadius: 16, padding: "3rem 2.8rem", border: "1px solid #0a1f4415", boxShadow: "0 20px 60px -15px rgba(10,31,68,0.2)" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 14px", background: "#f4c20d", borderRadius: 999, marginBottom: "1.2rem" }}>
              <Sparkles size={14} style={{ color: "#0a1f44" }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", fontWeight: 600, color: "#0a1f44", letterSpacing: "0.05em" }}>UVPT × VEILLE IA</span>
            </div>
            <h1 style={{ fontFamily: "var(--display)", fontSize: "2.4rem", fontWeight: 700, color: "#0a1f44", margin: "0 0 0.4rem", lineHeight: 1.1 }}>Veille appels à projets</h1>
            <p style={{ fontFamily: "var(--body)", color: "#555", fontSize: "0.95rem", lineHeight: 1.5, margin: "0 0 2rem" }}>
              Pour démarrer, saisis ta clé API Anthropic. Elle est stockée uniquement dans ton navigateur et sert à interroger Claude pour la recherche d'AAP et la génération de fiches conseil.
            </p>
            <label style={{ fontFamily: "var(--body)", fontSize: "0.8rem", fontWeight: 600, color: "#0a1f44", display: "block", marginBottom: 6 }}>
              <Key size={13} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
              Clé API Anthropic
            </label>
            <input type="password" placeholder="sk-ant-api03-..." value={inputKey} onChange={e => setInputKey(e.target.value)}
              onKeyDown={e => e.key === "Enter" && validerCleAPI()}
              style={{ width: "100%", padding: "0.85rem 1rem", border: "1.5px solid #0a1f4430", borderRadius: 8, fontFamily: "var(--mono)", fontSize: "0.82rem", background: "#fafafa", outline: "none", marginBottom: "1rem" }} />
            <button onClick={validerCleAPI} disabled={!inputKey}
              style={{ width: "100%", padding: "0.9rem", borderRadius: 8, border: "none", background: "#0a1f44", color: "#f4c20d", fontFamily: "var(--body)", fontSize: "0.9rem", fontWeight: 600, cursor: inputKey ? "pointer" : "not-allowed", opacity: inputKey ? 1 : 0.5, letterSpacing: "0.02em" }}>
              Activer la veille →
            </button>
            <p style={{ fontFamily: "var(--body)", fontSize: "0.75rem", color: "#888", marginTop: "1.5rem", lineHeight: 1.5 }}>
              🔒 La clé est stockée localement dans ton navigateur et ne transite que vers api.anthropic.com.
              Récupère-la sur <span style={{ color: "#0a1f44", fontWeight: 600 }}>console.anthropic.com</span>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============ APP PRINCIPALE ============
  return (
    <div style={baseStyles.container}>
      <GlobalStyles />

      {/* HEADER */}
      <header style={{ padding: "1.8rem 2.5rem 1.3rem", borderBottom: "1.5px solid #0a1f4415", background: "#f7f3e9", position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(8px)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, background: "#f4c20d", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={14} style={{ color: "#0a1f44" }} strokeWidth={2.5} />
              </div>
              <span style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", fontWeight: 600, color: "#0a1f44", letterSpacing: "0.08em" }}>UNE VOIE POUR TOUS · VEILLE STRATÉGIQUE</span>
            </div>
            <h1 style={{ fontFamily: "var(--display)", fontSize: "2.6rem", fontWeight: 700, color: "#0a1f44", margin: 0, lineHeight: 1 }}>
              Appels à projets
            </h1>
            <div style={{ fontFamily: "var(--body)", fontSize: "0.85rem", color: "#666", marginTop: 4 }}>
              {lastUpdate ? `Dernière mise à jour : ${lastUpdate}` : "Aucune recherche lancée"}
              {" · "}<span style={{ color: "#0a1f44", fontWeight: 600 }}>{aaps.length} AAP en base</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={exporterCSV} disabled={aaps.length === 0} style={btnStyles.ghost}>
              <Download size={13} /> Export CSV
            </button>
            <button onClick={viderBase} disabled={aaps.length === 0} style={btnStyles.ghostDanger}>
              <Trash2 size={13} /> Vider
            </button>
            <button onClick={supprimerCleAPI} style={btnStyles.ghost}>
              <Key size={13} /> Clé API
            </button>
            {refreshing ? (
              <button onClick={annulerRecherche} style={btnStyles.primaryDanger}>
                <X size={13} /> Annuler recherche
              </button>
            ) : (
              <button onClick={actualiserViaIA} style={btnStyles.primary}>
                {aaps.length === 0 ? <><Sparkles size={13} /> Lancer la veille IA</> : <><RefreshCw size={13} /> Actualiser via IA</>}
              </button>
            )}
          </div>
        </div>

        {/* BARRE PROGRESSION */}
        {refreshing && (
          <div style={{ marginTop: "1rem", padding: "0.85rem 1rem", background: "#0a1f44", borderRadius: 8, color: "white", display: "flex", alignItems: "center", gap: "1rem" }}>
            <Loader2 size={16} className="spin" style={{ color: "#f4c20d" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--body)", fontSize: "0.82rem", fontWeight: 500, marginBottom: 4 }}>{progressMsg}</div>
              <div style={{ height: 4, background: "#ffffff20", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(progressCount.vague / progressCount.total) * 100}%`, background: "#f4c20d", transition: "width 0.4s ease" }} />
              </div>
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: "0.8rem", color: "#f4c20d", fontWeight: 600 }}>
              {progressCount.trouves} AAP trouvés · {progressCount.vague}/{progressCount.total}
            </div>
          </div>
        )}

        {/* MESSAGE APRÈS RECHERCHE */}
        {!refreshing && progressMsg && (
          <div style={{ marginTop: "1rem", padding: "0.7rem 1rem", background: "#f4c20d", borderRadius: 8, color: "#0a1f44", fontFamily: "var(--body)", fontSize: "0.85rem", fontWeight: 500 }}>
            {progressMsg}
          </div>
        )}

        {/* STATS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.7rem", marginTop: "1.2rem" }}>
          {[
            { label: "AAP en base", value: stats.total, icon: FileText, tint: "#0a1f44" },
            { label: "Clôture < 30 jours", value: stats.urgent, icon: AlertCircle, tint: "#dc2626" },
            { label: "En cours", value: stats.encours, icon: Clock, tint: "#0a1f44" },
            { label: "Soumis", value: stats.soumis, icon: CheckCircle2, tint: "#166534" },
          ].map((s, i) => (
            <div key={i} style={{ padding: "0.8rem 1rem", background: "white", borderRadius: 10, border: "1px solid #0a1f4410", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: `${s.tint}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <s.icon size={18} style={{ color: s.tint }} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "#777", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                <div style={{ fontFamily: "var(--display)", fontSize: "1.7rem", fontWeight: 700, lineHeight: 1, color: s.tint }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      </header>

      <main style={{ padding: "1.3rem 2.5rem 3rem", maxWidth: 1400, margin: "0 auto" }}>

        {/* VUE VIDE */}
        {aaps.length === 0 && !refreshing && (
          <div style={{ textAlign: "center", padding: "4rem 2rem", background: "white", borderRadius: 14, border: "1.5px dashed #0a1f4430" }}>
            <div style={{ width: 72, height: 72, background: "#f4c20d", borderRadius: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "1.2rem" }}>
              <Sparkles size={32} style={{ color: "#0a1f44" }} strokeWidth={2} />
            </div>
            <h2 style={{ fontFamily: "var(--display)", fontSize: "1.6rem", fontWeight: 700, color: "#0a1f44", margin: "0 0 0.4rem" }}>Base vide</h2>
            <p style={{ fontFamily: "var(--body)", color: "#666", fontSize: "0.92rem", maxWidth: 480, margin: "0 auto 1.5rem", lineHeight: 1.5 }}>
              Lance la veille IA : Claude va explorer {VAGUES_RECHERCHE.length} thématiques en parallèle (éducation, jeunesse, insertion, politique de la ville, Europe, Outre-mer…) et remonter tous les AAP pertinents en temps réel.
            </p>
            <button onClick={actualiserViaIA} style={btnStyles.primary}>
              <Sparkles size={14} /> Lancer la veille IA
            </button>
          </div>
        )}

        {aaps.length > 0 && (
          <>
            {/* VUES RAPIDES */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: "1rem" }}>
              {[
                { id: "tous", label: `Tous (${aaps.length})` },
                { id: "urgent", label: `⚠ Urgents (${stats.urgent})` },
                { id: "afaire", label: "À faire" },
                { id: "encours", label: `En cours (${stats.encours})` },
                { id: "soumis", label: `Soumis (${stats.soumis})` },
              ].map(v => (
                <button key={v.id} onClick={() => setView(v.id)}
                  style={{ padding: "0.5rem 1rem", borderRadius: 6, border: "1px solid " + (view === v.id ? "#0a1f44" : "#0a1f4425"),
                    background: view === v.id ? "#0a1f44" : "white", color: view === v.id ? "#f4c20d" : "#0a1f44",
                    fontFamily: "var(--body)", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", transition: "all 0.18s" }}>
                  {v.label}
                </button>
              ))}
            </div>

            {/* FILTRES */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8, marginBottom: "1.3rem" }}>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#888" }} />
                <input type="text" placeholder="Rechercher un AAP, un organisme…" value={filters.recherche}
                  onChange={e => setFilters({ ...filters, recherche: e.target.value })}
                  style={inputStyle} />
              </div>
              <select value={filters.secteur} onChange={e => setFilters({ ...filters, secteur: e.target.value })} style={selectStyle}>
                {secteurs.map(s => <option key={s} value={s}>Secteur : {s}</option>)}
              </select>
              <select value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })} style={selectStyle}>
                {types.map(t => <option key={t} value={t}>Type : {t}</option>)}
              </select>
              <select value={filters.territoire} onChange={e => setFilters({ ...filters, territoire: e.target.value })} style={selectStyle}>
                {territoires.map(t => <option key={t} value={t}>Territoire : {t}</option>)}
              </select>
            </div>

            {/* LISTE AAP */}
            <div style={{ display: "grid", gap: "0.8rem" }}>
              {aapsFiltres.length === 0 && (
                <div style={{ padding: "3rem", textAlign: "center", color: "#777", background: "white", borderRadius: 10, fontFamily: "var(--body)" }}>
                  Aucun AAP ne correspond à ces critères.
                </div>
              )}
              {aapsFiltres.map(aap => {
                const jours = joursRestants(aap.dateCloture);
                const statut = statuts[aap.id] || "afaire";
                const urgent = jours >= 0 && jours <= 30;
                const clos = jours < 0;
                return (
                  <article key={aap.id} className="fadeIn hoverLift" style={{
                    background: "white", borderRadius: 12, border: "1px solid #0a1f4412", padding: "1.1rem 1.3rem",
                    borderLeft: urgent ? "4px solid #dc2626" : aap._nouveau ? "4px solid #f4c20d" : "4px solid transparent",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 300px", minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
                          {aap._nouveau && <Chip color="yellow">★ NOUVEAU</Chip>}
                          <Chip color={aap.pertinence === "Très élevée" ? "green" : aap.pertinence === "Élevée" ? "blue" : "gray"}>{aap.pertinence || "À évaluer"}</Chip>
                          <Chip>{aap.type}</Chip>
                        </div>
                        <h2 style={{ fontFamily: "var(--display)", fontSize: "1.25rem", fontWeight: 700, margin: "2px 0 4px", lineHeight: 1.3, color: "#0a1f44" }}>{aap.titre}</h2>
                        <div style={{ fontFamily: "var(--body)", fontSize: "0.8rem", color: "#555", display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: 6 }}>
                          <span style={infoLine}><Building2 size={11} /> {aap.organisme}</span>
                          <span style={infoLine}><MapPin size={11} /> {aap.territoire}</span>
                          {(aap.montantMin > 0 || aap.montantMax > 0) && (
                            <span style={infoLine}><Euro size={11} /> {(aap.montantMin || 0).toLocaleString("fr-FR")} – {(aap.montantMax || 0).toLocaleString("fr-FR")} €</span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                          {(aap.secteurs || []).map(s => <Chip key={s}>{s}</Chip>)}
                        </div>
                        <p style={{ fontFamily: "var(--body)", fontSize: "0.86rem", color: "#333", margin: 0, lineHeight: 1.5 }}>{aap.description}</p>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", minWidth: 180 }}>
                        {aap.dateCloture && (
                          <div style={{ fontFamily: "var(--body)", fontSize: "0.72rem", color: "#666", textAlign: "right" }}>
                            <Calendar size={11} style={{ display: "inline", marginRight: 4 }} />
                            Clôt. {new Date(aap.dateCloture).toLocaleDateString("fr-FR")}
                          </div>
                        )}
                        <div className={urgent && !clos ? "spin-subtle" : ""} style={{
                          fontFamily: "var(--display)", fontSize: "1.35rem", fontWeight: 700,
                          color: clos ? "#999" : urgent ? "#dc2626" : "#0a1f44", lineHeight: 1
                        }}>
                          {clos ? "Clôturé" : aap.dateCloture ? `J-${jours}` : "Permanent"}
                        </div>
                        <select value={statut} onChange={e => updateStatut(aap.id, e.target.value)} style={statutSelectStyle}>
                          <option value="afaire">○ À faire</option>
                          <option value="encours">⏳ En cours</option>
                          <option value="soumis">✓ Soumis</option>
                          <option value="ecarte">✗ Écarté</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6, marginTop: "0.8rem", paddingTop: "0.75rem", borderTop: "1px solid #0a1f4410", flexWrap: "wrap" }}>
                      <button onClick={() => genererConseil(aap)} style={btnStyles.primarySmall}>
                        <Sparkles size={11} /> {conseils[aap.id] ? "Voir fiche conseil" : "Générer fiche conseil IA"}
                      </button>
                      {aap.url && (
                        <a href={aap.url} target="_blank" rel="noopener noreferrer" style={{ ...btnStyles.ghostSmall, textDecoration: "none" }}>
                          <ExternalLink size={11} /> Candidater
                        </a>
                      )}
                      {aap.conditions && (
                        <span style={{ fontFamily: "var(--body)", fontSize: "0.72rem", color: "#777", alignSelf: "center", marginLeft: 6, flex: "1 1 200px" }}>
                          <strong style={{ color: "#0a1f44" }}>Conditions :</strong> {aap.conditions}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* MODALE FICHE CONSEIL */}
      {selectedAAP && (
        <div onClick={() => setSelectedAAP(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(10,31,68,0.55)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", overflow: "auto", backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} className="fadeIn"
            style={{ background: "#f7f3e9", maxWidth: 860, width: "100%", maxHeight: "90vh", overflow: "auto", borderRadius: 14, padding: "2.2rem 2.3rem", position: "relative" }}>
            <button onClick={() => setSelectedAAP(null)} style={{ position: "absolute", top: 14, right: 14, background: "#0a1f44", color: "#f4c20d", border: "none", cursor: "pointer", padding: 8, borderRadius: 8 }}><X size={16} /></button>

            <div style={{ fontFamily: "var(--mono)", fontSize: "0.68rem", color: "#0a1f44", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={12} style={{ color: "#f4c20d", fill: "#f4c20d" }} /> FICHE CONSEIL IA
            </div>
            <h2 style={{ fontFamily: "var(--display)", fontSize: "1.7rem", fontWeight: 700, color: "#0a1f44", margin: "0 0 4px", lineHeight: 1.2 }}>{selectedAAP.titre}</h2>
            <div style={{ fontFamily: "var(--body)", fontSize: "0.85rem", color: "#666", marginBottom: "1.5rem" }}>{selectedAAP.organisme}</div>

            {loadingConseil && (
              <div style={{ padding: "3rem", textAlign: "center" }}>
                <Loader2 size={32} className="spin" style={{ color: "#0a1f44" }} />
                <div style={{ fontFamily: "var(--body)", marginTop: "1rem", color: "#666" }}>Analyse stratégique en cours par Claude…</div>
                <div style={{ fontFamily: "var(--body)", marginTop: 4, fontSize: "0.78rem", color: "#999" }}>Recherche web + synthèse personnalisée UVPT</div>
              </div>
            )}

            {!loadingConseil && conseils[selectedAAP.id] && !conseils[selectedAAP.id].erreur && (
              <ConseilContent conseil={conseils[selectedAAP.id]} aap={selectedAAP} />
            )}

            {!loadingConseil && conseils[selectedAAP.id]?.erreur && (
              <div style={{ padding: "1rem", background: "#fef2f2", border: "1px solid #dc262630", borderRadius: 8, color: "#dc2626", fontFamily: "var(--body)", fontSize: "0.85rem" }}>
                <strong>Erreur :</strong> {conseils[selectedAAP.id].erreur}
                <button onClick={() => { const c = { ...conseils }; delete c[selectedAAP.id]; setConseils(c); genererConseil(selectedAAP); }}
                  style={{ ...btnStyles.ghostSmall, marginTop: 10 }}>Réessayer</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ SOUS-COMPOSANTS ============
function Chip({ children, color = "default" }) {
  const palette = {
    default: { bg: "#0a1f4408", fg: "#0a1f44", bd: "#0a1f4420" },
    yellow: { bg: "#f4c20d", fg: "#0a1f44", bd: "#f4c20d" },
    green: { bg: "#16653415", fg: "#166534", bd: "#16653430" },
    blue: { bg: "#0a1f4412", fg: "#0a1f44", bd: "#0a1f4425" },
    gray: { bg: "#eee", fg: "#666", bd: "#ddd" },
  }[color];
  return (
    <span style={{ display: "inline-block", fontFamily: "var(--mono)", fontSize: "0.65rem", letterSpacing: "0.04em",
      padding: "2px 7px", borderRadius: 4, border: `1px solid ${palette.bd}`, background: palette.bg, color: palette.fg, fontWeight: 600 }}>
      {children}
    </span>
  );
}

function ConseilContent({ conseil, aap }) {
  const coulAdeq = conseil.adequation === "Très forte" ? "#166534" : conseil.adequation === "Forte" ? "#0a1f44" : conseil.adequation === "Moyenne" ? "#c2410c" : "#dc2626";

  const Section = ({ titre, icon: Icon, accent = "#0a1f44", children }) => (
    <div style={{ marginBottom: "1.2rem", padding: "1rem 1.2rem", background: "white", borderRadius: 10, borderLeft: `3px solid ${accent}` }}>
      <h3 style={{ fontFamily: "var(--mono)", fontSize: "0.68rem", color: accent, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
        <Icon size={12} /> {titre}
      </h3>
      <div style={{ fontFamily: "var(--body)", fontSize: "0.88rem", lineHeight: 1.6, color: "#222" }}>{children}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.4rem", padding: "0.9rem 1.2rem", background: "white", borderRadius: 10, border: `2px solid ${coulAdeq}30` }}>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: "0.68rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Adéquation UVPT</div>
          <div style={{ fontFamily: "var(--display)", fontSize: "1.5rem", color: coulAdeq, fontWeight: 700 }}>{conseil.adequation}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {aap.dateCloture && <Chip color="yellow">Clôture {new Date(aap.dateCloture).toLocaleDateString("fr-FR")}</Chip>}
          {(aap.montantMin > 0 || aap.montantMax > 0) && <Chip>{(aap.montantMin || 0).toLocaleString("fr-FR")} – {(aap.montantMax || 0).toLocaleString("fr-FR")} €</Chip>}
        </div>
      </div>

      <Section titre="Analyse du financeur" icon={Building2}>{conseil.analyseFinanceur}</Section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem", marginBottom: "1.2rem" }}>
        <div style={{ padding: "1rem 1.2rem", background: "white", borderRadius: 10, borderLeft: "3px solid #166534" }}>
          <h3 style={{ fontFamily: "var(--mono)", fontSize: "0.68rem", color: "#166534", margin: "0 0 7px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.08em" }}>✓ Arguments</h3>
          <ul style={{ margin: 0, paddingLeft: "1rem", fontFamily: "var(--body)", fontSize: "0.85rem", lineHeight: 1.55, color: "#222" }}>
            {conseil.argumentsAdequation?.map((a, i) => <li key={i} style={{ marginBottom: 4 }}>{a}</li>)}
          </ul>
        </div>
        <div style={{ padding: "1rem 1.2rem", background: "white", borderRadius: 10, borderLeft: "3px solid #dc2626" }}>
          <h3 style={{ fontFamily: "var(--mono)", fontSize: "0.68rem", color: "#dc2626", margin: "0 0 7px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.08em" }}>⚠ Risques</h3>
          <ul style={{ margin: 0, paddingLeft: "1rem", fontFamily: "var(--body)", fontSize: "0.85rem", lineHeight: 1.55, color: "#222" }}>
            {conseil.risquesAdequation?.map((r, i) => <li key={i} style={{ marginBottom: 4 }}>{r}</li>)}
          </ul>
        </div>
      </div>

      <Section titre="Projets suggérés pour UVPT" icon={Target} accent="#f4c20d">
        {conseil.projetsSuggeres?.map((p, i) => (
          <div key={i} style={{ padding: "0.7rem 0", borderTop: i > 0 ? "1px solid #eee" : "none" }}>
            <div style={{ fontFamily: "var(--display)", fontSize: "1.05rem", fontWeight: 700, color: "#0a1f44", marginBottom: 3 }}>{p.nom}</div>
            <div style={{ marginBottom: 5 }}>{p.pitch}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "#666", display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span style={{ color: "#0a1f44", fontWeight: 600 }}>💰 {p.budgetIndicatif}</span>
              <span>✦ {p.angleDifferenciant}</span>
            </div>
          </div>
        ))}
      </Section>

      <Section titre="Stratégie de candidature" icon={TrendingUp}>{conseil.strategieCandidature}</Section>

      <Section titre="Points de vigilance" icon={AlertCircle} accent="#c2410c">
        <ul style={{ margin: 0, paddingLeft: "1rem" }}>
          {conseil.pointsVigilance?.map((p, i) => <li key={i} style={{ marginBottom: 4 }}>{p}</li>)}
        </ul>
      </Section>

      <Section titre="Checklist du dossier" icon={CheckCircle2} accent="#166534">
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
          {conseil.checklistDossier?.map((c, i) => <li key={i} style={{ marginBottom: 5 }}>☐ {c}</li>)}
        </ul>
      </Section>

      {conseil.contactsCles && (
        <Section titre="Contacts & approche" icon={Building2}>{conseil.contactsCles}</Section>
      )}
    </div>
  );
}

// ============ STYLES ============
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');


      :root {
        --body: 'DM Sans', 'Google Sans', 'Product Sans', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        --display: 'DM Sans', 'Google Sans', 'Product Sans', -apple-system, sans-serif;
        --mono: 'JetBrains Mono', 'Roboto Mono', monospace;
      }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: var(--body); }
      .spin { animation: spin 1.2s linear infinite; }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      .spin-subtle { animation: pulse 2s ease-in-out infinite; }
      @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
      .fadeIn { animation: fadeIn 0.35s cubic-bezier(.2,.8,.2,1); }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      .hoverLift { transition: all 0.22s cubic-bezier(.2,.8,.2,1); }
      .hoverLift:hover { transform: translateY(-2px); box-shadow: 0 12px 32px -10px rgba(10,31,68,0.18); border-color: #0a1f4430; }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      input:focus, select:focus { border-color: #0a1f44 !important; }
    `}</style>
  );
}

const baseStyles = {
  container: { fontFamily: "'DM Sans', 'Google Sans', sans-serif", minHeight: "100vh", background: "#f7f3e9", color: "#0a1f44" },
};

const btnStyles = {
  primary: { display: "inline-flex", alignItems: "center", gap: 6, padding: "0.55rem 1rem", borderRadius: 8, border: "none", background: "#0a1f44", color: "#f4c20d", fontFamily: "var(--body)", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", letterSpacing: "0.01em", transition: "all 0.18s" },
  primaryDanger: { display: "inline-flex", alignItems: "center", gap: 6, padding: "0.55rem 1rem", borderRadius: 8, border: "none", background: "#dc2626", color: "white", fontFamily: "var(--body)", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" },
  primarySmall: { display: "inline-flex", alignItems: "center", gap: 5, padding: "0.4rem 0.8rem", borderRadius: 6, border: "none", background: "#0a1f44", color: "#f4c20d", fontFamily: "var(--body)", fontSize: "0.73rem", fontWeight: 600, cursor: "pointer" },
  ghost: { display: "inline-flex", alignItems: "center", gap: 6, padding: "0.55rem 1rem", borderRadius: 8, border: "1px solid #0a1f4430", background: "white", color: "#0a1f44", fontFamily: "var(--body)", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" },
  ghostDanger: { display: "inline-flex", alignItems: "center", gap: 6, padding: "0.55rem 1rem", borderRadius: 8, border: "1px solid #dc262640", background: "white", color: "#dc2626", fontFamily: "var(--body)", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" },
  ghostSmall: { display: "inline-flex", alignItems: "center", gap: 5, padding: "0.4rem 0.8rem", borderRadius: 6, border: "1px solid #0a1f4430", background: "white", color: "#0a1f44", fontFamily: "var(--body)", fontSize: "0.73rem", fontWeight: 600, cursor: "pointer" },
};

const inputStyle = { width: "100%", padding: "0.6rem 0.75rem 0.6rem 2.1rem", border: "1px solid #0a1f4425", borderRadius: 6, fontFamily: "var(--body)", fontSize: "0.83rem", background: "white", outline: "none", color: "#0a1f44" };
const selectStyle = { padding: "0.6rem 0.75rem", border: "1px solid #0a1f4425", borderRadius: 6, fontFamily: "var(--body)", fontSize: "0.82rem", background: "white", color: "#0a1f44", cursor: "pointer", outline: "none" };
const statutSelectStyle = { padding: "0.3rem 0.5rem", borderRadius: 5, border: "1px solid #0a1f4430", background: "white", fontSize: "0.7rem", cursor: "pointer", fontFamily: "var(--mono)", fontWeight: 600, color: "#0a1f44", outline: "none" };
const infoLine = { display: "inline-flex", alignItems: "center", gap: 4 };
