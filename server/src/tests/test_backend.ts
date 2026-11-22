import { Standard, User, Document, DocumentChunk, ChatSession } from '../models';
import { UserRole, DocumentStatus, MessageRole } from '../constants/roles';
import { generateToken } from '../utils/jwt';
import { hashPassword, comparePassword } from '../utils/password';
import { createApp } from '../app';
import request from 'supertest';
import { Types } from 'mongoose';
import { RagService } from '../services/rag.service';
import { AiService } from '../services/ai.service';
import { DocumentService } from '../services/document.service';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    process.exitCode = 1;
  }
}

async function runTests() {
  console.log('\n=== RUNNING SECURITY & BACKEND HARDENING TESTS ===\n');

  // Test 1: Mongoose Models definitions & toJSON passwordHash stripping
  console.log('[Test Suite 1] Mongoose Model Schemas & toJSON Security');
  
  const user = new User({
    email: 'testuser@school.com',
    passwordHash: 'secret_hash_value',
    role: UserRole.STUDENT
  });
  const userJson = user.toJSON();
  assert(userJson.passwordHash === undefined, 'User toJSON() strips passwordHash from responses');

  // Test 2: Password hashing & verification
  console.log('\n[Test Suite 2] Password & JWT Utilities');
  const password = 'StrongPassword123!';
  const hash = await hashPassword(password);
  const isValid = await comparePassword(password, hash);
  assert(isValid === true, 'comparePassword validates correct password');

  // Test 3: LangChain Splitter & Embeddings
  console.log('\n[Test Suite 3] RAG Chunking & Vector Embeddings');
  const samplePages = [
    { pageNumber: 1, text: 'Photosynthesis is the process by which green plants transform light energy into chemical energy. ' .repeat(10) },
    { pageNumber: 2, text: 'Cellular respiration releases chemical energy from glucose molecules. ' .repeat(10) }
  ];
  const chunks = await RagService.splitIntoChunks(samplePages);
  assert(chunks.length >= 2, 'RecursiveCharacterTextSplitter generates chunks');
  assert(chunks[0].pageNumber === 1, 'Chunk retains correct page number 1');

  // Test 4: Express App, Helmet Headers & Security Middlewares
  console.log('\n[Test Suite 4] Security Headers, Payload Limits & Error Handling');
  const app = createApp();

  const healthRes = await request(app).get('/health');
  assert(healthRes.status === 200, 'GET /health returns 200 OK');
  assert(healthRes.headers['x-content-type-options'] === 'nosniff', 'Helmet sets X-Content-Type-Options: nosniff');
  assert(healthRes.headers['x-frame-options'] !== undefined, 'Helmet sets X-Frame-Options');

  // Setup mock user tokens
  const superAdminId = new Types.ObjectId();
  const teacherId = new Types.ObjectId();
  const studentId = new Types.ObjectId();
  const standard10Id = new Types.ObjectId();
  const standard12Id = new Types.ObjectId();

  const mockUsers: Record<string, any> = {
    [superAdminId.toString()]: {
      _id: superAdminId,
      email: 'admin@school.com',
      role: UserRole.SUPER_ADMIN,
      standardId: null
    },
    [teacherId.toString()]: {
      _id: teacherId,
      email: 'teacher@school.com',
      role: UserRole.TEACHER,
      standardId: standard10Id
    },
    [studentId.toString()]: {
      _id: studentId,
      email: 'student@school.com',
      role: UserRole.STUDENT,
      standardId: standard10Id
    }
  };

  const originalFindById = User.findById;
  (User as any).findById = function (id: any) {
    const u = mockUsers[id.toString()];
    return {
      select: () => Promise.resolve(u),
      populate: () => ({
        populate: () => Promise.resolve(u)
      })
    };
  };

  const adminToken = generateToken({
    userId: superAdminId.toString(),
    email: 'admin@school.com',
    role: UserRole.SUPER_ADMIN,
    standardId: null
  });

  const teacherToken = generateToken({
    userId: teacherId.toString(),
    email: 'teacher@school.com',
    role: UserRole.TEACHER,
    standardId: standard10Id.toString()
  });

  const studentToken = generateToken({
    userId: studentId.toString(),
    email: 'student@school.com',
    role: UserRole.STUDENT,
    standardId: standard10Id.toString()
  });

  // Test 5: Strong password validation rules
  console.log('\n[Test Suite 5] Strong Password Validation (min 8 chars, 1 uppercase, 1 number)');
  const weakPasswordTeacher = await request(app)
    .post('/api/admin/teachers')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      email: 'newteacher@school.com',
      password: 'weak', // no uppercase, no number, < 8 chars
      standardId: standard10Id.toString()
    });
  assert(weakPasswordTeacher.status === 400, 'Rejects teacher password shorter than 8 chars (400)');

  const noUppercasePassword = await request(app)
    .post('/api/admin/teachers')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      email: 'newteacher@school.com',
      password: 'password123', // missing uppercase
      standardId: standard10Id.toString()
    });
  assert(noUppercasePassword.status === 400, 'Rejects teacher password without uppercase letter (400)');

  const noNumberPassword = await request(app)
    .post('/api/teacher/students')
    .set('Authorization', `Bearer ${teacherToken}`)
    .send({
      email: 'newstudent@school.com',
      password: 'PasswordOnly', // missing number
      standardId: standard10Id.toString()
    });
  assert(noNumberPassword.status === 400, 'Rejects student password without number (400)');

  // Test 6: PDF Magic Bytes Guardrail
  console.log('\n[Test Suite 6] PDF Magic Bytes Verification (%PDF-)');
  const fakePdfBuffer = Buffer.from('NOT A REAL PDF HEADER - MALICIOUS CONTENT');
  const fakePdfUpload = await request(app)
    .post('/api/documents/upload')
    .set('Authorization', `Bearer ${teacherToken}`)
    .field('standardId', standard10Id.toString())
    .field('subjectName', 'Mathematics')
    .attach('file', fakePdfBuffer, 'fake.pdf');
  assert(fakePdfUpload.status === 400, 'Rejects file without %PDF- magic bytes even if named .pdf (400)');

  // Test 7: Zero-Trust RBAC & Ownership checks
  console.log('\n[Test Suite 7] Zero-Trust Ownership & Access Checks');
  
  // Teacher uploading for standard12Id when assigned to standard10Id
  const realPdfHeader = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
  const teacherMismatchedUpload = await request(app)
    .post('/api/documents/upload')
    .set('Authorization', `Bearer ${teacherToken}`)
    .field('standardId', standard12Id.toString())
    .field('subjectName', 'Mathematics')
    .attach('file', realPdfHeader, 'test.pdf');
  assert(teacherMismatchedUpload.status === 403, 'Teacher uploading to unassigned standard returns 403 Forbidden');

  // Teacher creating student for standard12Id when assigned to standard10Id
  const teacherMismatchedStudent = await request(app)
    .post('/api/teacher/students')
    .set('Authorization', `Bearer ${teacherToken}`)
    .send({
      email: 'foreignstudent@school.com',
      password: 'StrongPassword123!',
      standardId: standard12Id.toString()
    });
  assert(teacherMismatchedStudent.status === 403, 'Teacher creating student for unassigned standard returns 403 Forbidden');

  // Test 8: Prompt Injection Guardrails & Chat Length
  console.log('\n[Test Suite 8] Chat Question Length & Prompt Guardrails');
  const tooLongQuestion = 'A'.repeat(601);
  const longQuestionRes = await request(app)
    .post('/api/chat')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      subjectName: 'Physics',
      question: tooLongQuestion
    });
  assert(longQuestionRes.status === 400, 'Rejects question exceeding 600 characters with 400 Bad Request');

  // Restore mocks
  (User as any).findById = originalFindById;

  console.log(`\n=========================================`);
  console.log(`Test Results: ${passedTests}/${totalTests} Passed`);
  console.log(`=========================================\n`);

  if (passedTests === totalTests) {
    console.log('ALL SECURITY HARDENING TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
