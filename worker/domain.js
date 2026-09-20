export const TABLES = [
  "users",
  "documents",
  "print_jobs",
  "payments",
  "printers",
  "printer_status",
  "pricing",
  "analytics",
  "resource_usage",
  "ai_insights",
];
export const DEFAULT_PRICING = {
  a4_bw: 1,
  a4_duplex: 1.5,
  a4_color: 5,
  a3_bw: 3,
  a3_duplex: 4.5,
  a3_color: 10,
};
export const now = () => new Date().toISOString();
export const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
export function price(a, s, p) {
  const copies = Number(s.copies ?? 1),
    nup = Number(s.nup ?? 1),
    paper = s.paper || "A4",
    mode = s.mode || "bw",
    orientation = s.orientation || "auto",
    duplex = s.duplex ?? true;
  if (
    !Number.isInteger(copies) ||
    copies < 1 ||
    copies > 100 ||
    ![1, 2, 4].includes(nup) ||
    !["A4", "A3"].includes(paper) ||
    !["bw", "color", "auto"].includes(mode) ||
    !["auto", "portrait", "landscape"].includes(orientation) ||
    typeof duplex !== "boolean"
  )
    fail("Check your print settings. Copies must be 1–100.");
  const range = String(s.range || "").trim();
  let selected = new Set();
  if (!range) for (let i = 1; i <= a.total_pages; i++) selected.add(i);
  else
    for (const piece of range.split(",")) {
      if (!/^\s*\d+(\s*-\s*\d+)?\s*$/.test(piece))
        fail("Use a page range such as 1-4, 7, 9-12.");
      const ends = piece.split("-").map(Number);
      const start = ends[0],
        end = ends.at(-1);
      if (start < 1 || end > a.total_pages || end < start)
        fail(`Page range must be between 1 and ${a.total_pages}.`);
      for (let i = start; i <= end; i++) selected.add(i);
    }
  const original = selected.size * copies;
  if (s.remove_blank) for (const i of a.blank_pages) selected.delete(i);
  selected = [...selected].sort((a, b) => a - b);
  if (!selected.length) fail("Choose at least one non-blank page to print.");
  const color = new Set(a.color_pages),
    groups = [];
  for (let i = 0; i < selected.length; i += nup)
    groups.push(selected.slice(i, i + nup));
  const types = groups.map(
    (g) => mode === "color" || (mode === "auto" && g.some((n) => color.has(n))),
  );
  let amount = 0;
  const prefix = paper.toLowerCase();
  types.forEach((t, i) => {
    if (t) amount += p[prefix + "_color"];
    else if (
      duplex &&
      ((i % 2 === 0 && i + 1 < types.length && !types[i + 1]) ||
        (i % 2 === 1 && !types[i - 1]))
    )
      amount += p[prefix + "_duplex"] / 2;
    else amount += p[prefix + "_bw"];
  });
  const sheets = Math.ceil(groups.length / (duplex ? 2 : 1)) * copies,
    colorPages =
      selected.filter(
        (n) => mode === "color" || (mode === "auto" && color.has(n)),
      ).length * copies;
  return {
    pages: selected.length,
    selected_pages: selected,
    impressions: groups.length * copies,
    sheets,
    original_sheets: original,
    saved_sheets: original - sheets,
    color_pages: colorPages,
    bw_pages: selected.length * copies - colorPages,
    amount: Math.round(amount * copies * 100) / 100,
    settings: {
      copies,
      nup,
      paper,
      mode,
      duplex,
      orientation,
      range,
      remove_blank: !!s.remove_blank,
    },
  };
}
export function transition(job, status, at = now()) {
  job.status = status;
  job.updated_at = at;
  job.timeline.push({ status, at });
  return job;
}
export function summary(jobs, printers, opts = {}) {
  const today = now().slice(0, 10),
    start =
      opts.start ||
      new Date(Date.now() - ((opts.days || 7) - 1) * 864e5)
        .toISOString()
        .slice(0, 10),
    end = opts.end || today;
  const rows = jobs.filter(
      (j) =>
        j.created_at.slice(0, 10) >= start &&
        j.created_at.slice(0, 10) <= end &&
        (!opts.source ||
          opts.source === "all" ||
          !!j.seed === (opts.source === "sample")),
    ),
    complete = rows.filter((j) => j.status === "Completed");
  const total = (k) => complete.reduce((s, j) => s + (j.quote[k] || 0), 0),
    activity = [];
  let d = new Date(start + "T00:00:00Z");
  for (let i = 0; i < 93 && d.toISOString().slice(0, 10) <= end; i++) {
    const key = d.toISOString().slice(0, 10),
      day = rows.filter((j) => j.created_at.slice(0, 10) === key);
    activity.push({
      date: key,
      label: d.toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "UTC",
      }),
      jobs: day.length,
      pages: day
        .filter((j) => j.status === "Completed")
        .reduce((s, j) => s + j.quote.pages * j.settings.copies, 0),
      sheets: day
        .filter((j) => j.status === "Completed")
        .reduce((s, j) => s + j.quote.sheets, 0),
    });
    d = new Date(d.getTime() + 864e5);
  }
  return {
    jobs: rows.length,
    today_jobs: jobs.filter((j) => j.created_at.slice(0, 10) === today).length,
    pages: total("bw_pages") + total("color_pages"),
    bw: total("bw_pages"),
    color: total("color_pages"),
    saved: total("saved_sheets"),
    sheets: total("sheets"),
    revenue: Math.round(complete.reduce((s, j) => s + j.amount, 0) * 100) / 100,
    active: rows.filter((j) =>
      ["Queued", "Sent to Controller", "Printing"].includes(j.status),
    ).length,
    completed: complete.length,
    failed: rows.filter((j) => j.status === "Failed").length,
    duplex: complete.filter((j) => j.settings.duplex).length,
    single: complete.filter((j) => !j.settings.duplex).length,
    activity,
    sample_jobs: rows.filter((j) => j.seed).length,
    new_jobs: rows.filter((j) => !j.seed).length,
    start,
    end,
    avg_wait:
      Math.round(
        (complete.reduce(
          (s, j) =>
            s +
            Math.max(
              0,
              (Date.parse(j.started_at || j.created_at) -
                Date.parse(j.created_at)) /
                6e4,
            ),
          0,
        ) /
          Math.max(1, complete.length)) *
          10,
      ) / 10,
    utilization: printers.map((p) => ({
      name: p.name,
      pages: complete
        .filter((j) => j.printer_id === p.id)
        .reduce((s, j) => s + j.quote.pages * j.settings.copies, 0),
    })),
    peak: Array.from({ length: 11 }, (_, i) => ({
      hour: i + 8,
      jobs: rows.filter((j) => new Date(j.created_at).getUTCHours() === i + 8)
        .length,
    })),
  };
}
export function insights(jobs, printers) {
  const s = summary(jobs, printers),
    out = [];
  if (s.saved)
    out.push({
      type: "green",
      title: `${s.saved} sheets saved this week`,
      text: "Compared with printing each selected page on its own sheet. Duplex and multiple pages per side make a difference.",
      action: "See resource usage",
      to: "/usage",
    });
  const available = printers
    .filter((p) => p.enabled)
    .sort((a, b) => a.queue_length - b.queue_length);
  if (available.length)
    out.push({
      type: "blue",
      title: available[0].name + " is a good place to start",
      text: "It currently has the shortest active queue among available printers.",
      action: "Start a print",
      to: "/new",
    });
  if (s.pages)
    out.push({
      type: "cyan",
      title:
        Math.round((s.bw / s.pages) * 100) +
        "% of printed pages are monochrome",
      text: "Use Auto color to reserve color pricing for pages that actually need it.",
      action: "Analyze a document",
      to: "/new",
    });
  if (s.single)
    out.push({
      type: "orange",
      title: s.single + " jobs could use duplex",
      text: "These completed jobs used single-sided printing. Check document requirements before switching.",
      action: "Explore insights",
      to: "/insights",
    });
  const peak = s.peak.toSorted((a, b) => b.jobs - a.jobs)[0];
  if (peak.jobs)
    out.push({
      type: "blue",
      title: `Busiest hour: ${String(peak.hour).padStart(2, "0")}:00–${peak.hour + 1}:00 UTC`,
      text: "Based on the last seven days of recorded job creation times, including labeled sample records.",
      action: "View analytics",
      to: "/usage",
    });
  return out;
}
export function seedData(w) {
  const records = [
    [
      "users",
      {
        id: "profile",
        name: "Campus member",
        email: "",
        notify: true,
        default_duplex: true,
        workspace: w,
      },
    ],
    ["pricing", { id: "rates", ...DEFAULT_PRICING }],
  ];
  [
    ["Printer 01", "HP LaserJet Pro", "Library · Ground floor", "USB"],
    ["Printer 02", "Canon imageCLASS", "Academic block · Room 102", "Wi-Fi"],
    ["Printer 03", "Epson EcoTank", "Student centre", "USB"],
  ].forEach(([name, model, location, connection], i) =>
    records.push([
      "printers",
      {
        id: `pi-0${i + 1}`,
        name,
        model,
        location,
        connection,
        enabled: true,
        color: i !== 0,
        a3: i === 2,
        paper_level: null,
        simulated: true,
      },
    ]),
  );
  const names = [
    "Assignment.pdf",
    "Lab_Record.pdf",
    "Project_Report.pdf",
    "Lecture_Notes.pdf",
    "Circuit_Diagrams.pdf",
    "Research_Paper.pdf",
    "Semester_Syllabus.pdf",
  ];
  for (let day = 6; day >= 0; day--)
    for (let n = 0; n < 5 + ((6 - day) % 4); n++) {
      const serial = (6 - day) * 9 + n,
        total = [12, 24, 8, 32, 16, 40, 6][n % 7],
        a = {
          total_pages: total,
          blank_pages: [],
          color_pages:
            n % 4 === 0 ? Array.from({ length: total }, (_, i) => i + 1) : [],
        };
      const q = price(
        a,
        {
          copies: 1,
          paper: "A4",
          duplex: n % 3 !== 0,
          mode: n % 4 === 0 ? "color" : "bw",
          nup: 1,
          range: "",
          remove_blank: false,
          orientation: "auto",
        },
        DEFAULT_PRICING,
      );
      let dt = new Date(Date.now() - day * 864e5);
      dt.setUTCHours(8 + n, 12 + (serial % 39), 0, 0);
      if (dt.getTime() > Date.now())
        dt = new Date(Date.now() - (10 + (8 - n) * 7) * 6e4);
      const at = dt.toISOString(),
        id = `AP-${new Date().getFullYear()}-${1000 + serial}`;
      records.push([
        "print_jobs",
        {
          id,
          document_id: null,
          document_name: names[n % 7],
          printer_id: `pi-0${n % 4 === 0 ? 2 : (n % 3) + 1}`,
          settings: q.settings,
          quote: q,
          amount: q.amount,
          status: "Completed",
          payment_status: "Verified",
          payment_mode: "test",
          created_at: at,
          updated_at: at,
          started_at: new Date(
            dt.getTime() + (80 + (serial % 100)) * 1000,
          ).toISOString(),
          seed: true,
          timeline: [{ status: "Completed", at }],
        },
      ]);
    }
  return records;
}
