import fs from "fs";
import path from "path";

export const saveFileForUser1 = (userId, buffer, originalName) => {
  const uploadDir = "./uploads";

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const fileName = `${userId}_${Date.now()}_${originalName}`;
  const filePath = path.join(uploadDir, fileName);

  fs.writeFileSync(filePath, buffer);

  return fileName;  // Return stored file name
};
