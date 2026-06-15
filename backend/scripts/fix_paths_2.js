const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    for (const [from, to] of replacements) {
        if (content.includes(from)) {
            content = content.split(from).join(to);
            modified = true;
        }
    }
    if (modified) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${filePath}`);
    }
}

const bookingServiceTest = path.join(__dirname, '../src/__tests__/unit/services/BookingService.test.js');
replaceInFile(bookingServiceTest, [
    ['../../../../models/', '../../../models/'],
    ['../../../../repositories/', '../../../repositories/'],
    ['../../../../config/', '../../../config/'],
    ['../../../../services/', '../../../services/']
]);

const expertServiceTest = path.join(__dirname, '../src/__tests__/unit/services/ExpertService.test.js');
replaceInFile(expertServiceTest, [
    ['../../../../models/', '../../../models/'],
    ['../../../../repositories/', '../../../repositories/'],
    ['../../../../config/', '../../../config/'],
    ['../../../../services/', '../../../services/']
]);

const uploadMiddlewareTest = path.join(__dirname, '../src/__tests__/unit/middleware/uploadMiddleware.test.js');
replaceInFile(uploadMiddlewareTest, [
    ['../../../../frontend/public/uploads', '../../../../../frontend/public/uploads']
]);
