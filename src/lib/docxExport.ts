/**
 * docxExport.ts
 *
 * Client-side .docx generator using JSZip.
 * Exports only the numbered questions — no headers, no metadata, no instructions.
 */

import JSZip from "jszip";
import type { TheoryQuestion } from "@/lib/services/theoryQuestionService";

export interface ExamPaperMetadata {
  subject: string;
}

const escapeXml = (unsafe: string = ""): string =>
  unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const dataUrlToArrayBuffer = (
  dataUrl: string
): { buffer: ArrayBuffer; format: "png" | "jpeg" } | null => {
  try {
    const matches = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
    if (!matches) return null;
    const format = matches[1].toLowerCase() === "png" ? "png" : "jpeg";
    const binary = atob(matches[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { buffer: bytes.buffer, format };
  } catch {
    return null;
  }
};

export const downloadExamPaperDocx = async (
  questions: TheoryQuestion[],
  meta: ExamPaperMetadata
): Promise<void> => {
  const zip = new JSZip();
  const subject = meta.subject || "Questions";

  const imageRels: Array<{ rId: string; filename: string }> = [];
  let imageCounter = 1;
  let bodyXml = "";

  // Numbered questions only
  questions.forEach((q, idx) => {
    const num = idx + 1;
    const marksLabel = q.marks != null ? `  [${q.marks} marks]` : "";
    const questionLine = `Q${num}. ${escapeXml(q.questionText)}${escapeXml(marksLabel)}`;

    bodyXml += `
      <w:p>
        <w:pPr><w:spacing w:before="160" w:after="80"/></w:pPr>
        <w:r>
          <w:rPr><w:b/><w:sz w:val="22"/></w:rPr>
          <w:t xml:space="preserve">${questionLine}</w:t>
        </w:r>
      </w:p>
    `;

    // Sub-parts
    if (q.subParts && q.subParts.length > 0) {
      q.subParts.forEach((sp) => {
        const spMarks = sp.marks != null ? `  [${sp.marks} marks]` : "";
        bodyXml += `
          <w:p>
            <w:pPr><w:ind w:left="480"/><w:spacing w:before="40" w:after="40"/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="20"/></w:rPr>
              <w:t xml:space="preserve">${escapeXml(sp.label || "")} ${escapeXml(sp.text || "")}${escapeXml(spMarks)}</w:t>
            </w:r>
          </w:p>
        `;
      });
    }

    // Diagram image if attached
    if (q.diagramUrl) {
      const parsedImage = dataUrlToArrayBuffer(q.diagramUrl);
      if (parsedImage) {
        const rId = `rImg${imageCounter}`;
        const filename = `img${imageCounter}.${parsedImage.format}`;
        zip.file(`word/media/${filename}`, parsedImage.buffer);
        imageRels.push({ rId, filename });

        bodyXml += `
          <w:p>
            <w:pPr><w:ind w:left="480"/><w:spacing w:before="60" w:after="100"/></w:pPr>
            <w:r>
              <w:drawing>
                <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
                  <wp:extent cx="3200000" cy="2000000"/>
                  <wp:docPr id="${imageCounter}" name="Figure ${imageCounter}"/>
                  <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                      <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                        <pic:nvPicPr>
                          <pic:cNvPr id="0" name="${filename}"/>
                          <pic:cNvPicPr/>
                        </pic:nvPicPr>
                        <pic:blipFill>
                          <a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                          <a:stretch><a:fillRect/></a:stretch>
                        </pic:blipFill>
                        <pic:spPr>
                          <a:xfrm><a:off x="0" y="0"/><a:ext cx="3200000" cy="2000000"/></a:xfrm>
                          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                        </pic:spPr>
                      </pic:pic>
                    </a:graphicData>
                  </a:graphic>
                </wp:inline>
              </w:drawing>
            </w:r>
          </w:p>
        `;
        imageCounter++;
      }
    }
  });

  // ── Assemble ZIP ──

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Default Extension="png" ContentType="image/png"/>
      <Default Extension="jpeg" ContentType="image/jpeg"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`
  );

  let docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
  imageRels.forEach((rel) => {
    docRelsXml += `<Relationship Id="${rel.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${rel.filename}"/>`;
  });
  docRelsXml += `</Relationships>`;
  zip.file("word/_rels/document.xml.rels", docRelsXml);

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        ${bodyXml}
        <w:sectPr>
          <w:pgSz w:w="11906" w:h="16838"/>
          <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/>
        </w:sectPr>
      </w:body>
    </w:document>`;
  zip.file("word/document.xml", documentXml);

  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `${subject.replace(/[^a-zA-Z0-9]/g, "_")}_Questions_${new Date().toISOString().slice(0, 10)}.docx`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(link.href), 30000);
};
