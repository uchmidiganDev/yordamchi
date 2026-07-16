import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // unpdf (pdf.js) serverless funksiyada runtime'da node_modules'dan yuklansin,
  // bundle qilinganda pdf.js'ning dinamik require'lari buzilmasligi uchun.
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
