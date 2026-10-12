import { Router } from 'express';
import {
  createCompany,
  getCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
} from '../controllers/companyController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  validateCreateCompany,
  validateUpdateCompany,
  validateCompanyIdParam,
} from '../validators/companyValidator.js';

const router = Router();

router.use(authenticate);

// View companies (Employees see active, Admins see all)
router.get('/', getCompanies);
router.get('/:id', validateCompanyIdParam, validate, getCompanyById);

// Allow Admin, Staff, and Employees to add companies
router.post('/', validateCreateCompany, validate, createCompany);
router.put('/:id', authorize('admin'), validateUpdateCompany, validate, updateCompany);
router.delete('/:id', authorize('admin'), validateCompanyIdParam, validate, deleteCompany);

export default router;
