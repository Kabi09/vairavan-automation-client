import mongoose from 'mongoose';
import Client from '../models/Client.js';
import Company from '../models/Company.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * @desc    Create a new client linked to a company
 * @route   POST /api/clients
 * @access  Private (Employee, Staff, Admin)
 */
export const createClient = asyncHandler(async (req, res) => {
  const { companyId, clientName, clientPhoneNumber } = req.body;

  if (!companyId) {
    throw ApiError.badRequest('Company ID is required');
  }

  if (!clientName || !clientName.trim()) {
    throw ApiError.badRequest('Client name is required');
  }

  const company = await Company.findOne({ _id: companyId, isDeleted: false });
  if (!company) {
    throw ApiError.notFound('Company not found');
  }

  const client = await Client.create({
    company: companyId,
    clientName: clientName.trim(),
    clientPhoneNumber: clientPhoneNumber ? clientPhoneNumber.trim() : '',
    createdBy: req.user._id,
  });

  const populatedClient = await Client.findById(client._id).populate(
    'company',
    'companyName location companyPhoneNumber companyType'
  );

  return ApiResponse.created(res, 'Client added successfully', { client: populatedClient });
});

/**
 * @desc    Get clients, optionally filtered by company
 * @route   GET /api/clients
 * @access  Private
 */
export const getClients = asyncHandler(async (req, res) => {
  const { companyId, search, status } = req.query;

  const filter = { isDeleted: false };

  if (companyId) {
    filter.company = companyId;
  }

  if (status) {
    filter.status = status;
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ clientName: searchRegex }, { clientPhoneNumber: searchRegex }];
  }

  const clients = await Client.find(filter)
    .sort({ clientName: 1 })
    .populate('company', 'companyName location companyPhoneNumber companyType');

  return ApiResponse.success(res, 200, 'Clients retrieved successfully', { clients });
});

/**
 * @desc    Get single client by ID
 * @route   GET /api/clients/:id
 * @access  Private
 */
export const getClientById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const client = await Client.findOne({ _id: id, isDeleted: false }).populate(
    'company',
    'companyName location companyPhoneNumber companyType'
  );

  if (!client) {
    throw ApiError.notFound('Client not found');
  }

  return ApiResponse.success(res, 200, 'Client retrieved successfully', { client });
});

/**
 * @desc    Update client
 * @route   PUT /api/clients/:id
 * @access  Private
 */
export const updateClient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { clientName, clientPhoneNumber, status } = req.body;

  const client = await Client.findOne({ _id: id, isDeleted: false });
  if (!client) {
    throw ApiError.notFound('Client not found');
  }

  if (clientName) client.clientName = clientName.trim();
  if (clientPhoneNumber !== undefined) client.clientPhoneNumber = clientPhoneNumber.trim();
  if (status) client.status = status;

  await client.save();

  return ApiResponse.success(res, 200, 'Client updated successfully', { client });
});

/**
 * @desc    Delete client (soft delete)
 * @route   DELETE /api/clients/:id
 * @access  Private (Admin)
 */
export const deleteClient = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const client = await Client.findOne({ _id: id, isDeleted: false });
  if (!client) {
    throw ApiError.notFound('Client not found');
  }

  client.isDeleted = true;
  await client.save();

  return ApiResponse.success(res, 200, 'Client removed successfully');
});
