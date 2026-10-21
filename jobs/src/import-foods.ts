/**
 * 식약처 식품영양성분 DB(음식) 엑셀 파일을 Food 테이블로 가져온다.
 *
 *   npm run import-foods -w @health/jobs -- "C:\Users\...\Downloads\음식DB.xlsx"
 *
 * 파일 받는 곳: https://various.foodsafetykorea.go.kr/nutrient/general/down/list.do → 음식 DB
 * 열 순서가 바뀌어도 되도록 머리글 이름으로 열을 찾는다. 다시 실행하면 같은 식품코드는 덮어쓴다.
 */
import { db } from "@health/db";
import ExcelJS from "exceljs";

const file = process.argv[2];
if (!file) {
  console.error("사용법: npm run import-foods -w @health/jobs -- <음식DB.xlsx 경로>");
  process.exit(1);
}

/** 머리글 → 열 이름 매칭 규칙 (앞에 있는 것이 우선) */
const COLUMNS = {
  code: [/^식품코드$/, /코드/],
  name: [/^식품명$/, /식품명/],
  category: [/대표식품명/, /식품대분류명/, /대분류/],
  base: [/영양성분함량기준량/, /기준량/],
  serving: [/1회\s*섭취\s*참고량/, /1회\s*제공량/, /식품중량/],
  kcal: [/에너지\s*\(kcal\)/i, /^에너지/, /열량/],
  protein: [/^단백질/],
  fat: [/^지방/],
  carbs: [/^탄수화물/],
  sugar: [/^당류/, /총\s*당류/],
  sodium: [/^나트륨/],
} as const;

type Col = keyof typeof COLUMNS;

const text = (v: ExcelJS.CellValue): string => {
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("");
  if (typeof v === "object" && "result" in v) return String(v.result ?? "");
  return String(v).trim();
};

/** "100g", "1,234.5", "-" → 숫자 */
const num = (v: ExcelJS.CellValue): number | null => {
  const m = text(v).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(file);
const sheet = workbook.worksheets[0]!;

// 머리글 행 찾기: '식품명' 이 들어 있는 첫 행 (위쪽 10행 안)
let headerRow = 0;
const colIndex: Partial<Record<Col, number>> = {};
for (let r = 1; r <= Math.min(10, sheet.rowCount) && !headerRow; r++) {
  const headers = (sheet.getRow(r).values as ExcelJS.CellValue[]).map(text);
  if (!headers.some((h) => /식품명/.test(h))) continue;
  headerRow = r;
  for (const [col, patterns] of Object.entries(COLUMNS) as [Col, readonly RegExp[]][]) {
    for (const p of patterns) {
      const i = headers.findIndex((h) => p.test(h.replace(/\s+/g, " ")));
      if (i > 0) {
        colIndex[col] = i;
        break;
      }
    }
  }
}

const required: Col[] = ["code", "name", "kcal"];
const missing = required.filter((c) => !colIndex[c]);
if (!headerRow || missing.length) {
  console.error(`머리글을 찾지 못했습니다 (없는 열: ${missing.join(", ") || "머리글 행"}). 파일 형식을 확인하세요.`);
  process.exit(1);
}
console.log(
  "열 매핑:",
  Object.fromEntries(Object.entries(colIndex).map(([k, i]) => [k, text(sheet.getRow(headerRow).getCell(i!).value)])),
);

const foods = [];
for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
  const row = sheet.getRow(r);
  const get = (c: Col) => (colIndex[c] ? row.getCell(colIndex[c]!).value : null);
  const id = text(get("code"));
  const name = text(get("name"));
  const kcal = num(get("kcal"));
  if (!id || !name || kcal === null) continue;

  // 영양성분이 100g 이 아닌 다른 기준량으로 적혀 있으면 100g 기준으로 환산
  const base = num(get("base")) ?? 100;
  const per100 = (v: number | null) => (v === null ? null : (v * 100) / base);

  foods.push({
    id,
    name,
    category: text(get("category")) || null,
    servingSize: num(get("serving")),
    kcal: per100(kcal)!,
    proteinG: per100(num(get("protein"))),
    fatG: per100(num(get("fat"))),
    carbsG: per100(num(get("carbs"))),
    sugarG: per100(num(get("sugar"))),
    sodiumMg: per100(num(get("sodium"))),
  });
}

let done = 0;
for (let i = 0; i < foods.length; i += 500) {
  const chunk = foods.slice(i, i + 500);
  await db.$transaction(chunk.map((f) => db.food.upsert({ where: { id: f.id }, create: f, update: f })));
  done += chunk.length;
  process.stdout.write(`\r${done} / ${foods.length}`);
}
console.log(`\n[import-foods] ${foods.length}개 음식을 가져왔습니다.`);
await db.$disconnect();
