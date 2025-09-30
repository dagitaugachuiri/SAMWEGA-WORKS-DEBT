const Joi = require('joi');

// Kenyan phone number validation
const phoneSchema = Joi.string()
  .pattern(/^\+254[17]\d{8}$/)
  .message('Phone number must be in format +254XXXXXXXXX');

// Bank detail schema for bank payments
const bankDetailSchema = Joi.object({
  bankName: Joi.string().required(),
  amount: Joi.number().positive().required(),
  transactionCode: Joi.string().min(3).max(50).required()
});

// Debt creation validation schema
const debtSchema = Joi.object({
  storeOwner: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    phoneNumber: phoneSchema.required(),
    email: Joi.string().email().optional().allow('')
  }).required(),
  
  store: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    location: Joi.string().min(2).max(100).required(),
    locationCoords: Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required()
    }).optional()
  }).required(),
  
  amount: Joi.number().positive().max(10000000).required(),
  dateIssued: Joi.date().max('now').required(),
  dueDate: Joi.date().min(Joi.ref('dateIssued')).required(),
  paymentMethod: Joi.string().valid('mpesa', 'bank', 'cheque').required(),
  description: Joi.string().max(500).optional().allow(''),
  createdBy: Joi.string().min(2).max(100).required(),
  vehiclePlate: Joi.string().allow('').required()
    .messages({
      'any.required': 'Vehicle plate number is required',
      'string.base': 'Vehicle plate number must be a string'
    }),
  salesRep: Joi.string().min(2).max(100).required()
    .messages({
      'any.required': 'Sales representative name is required',
      'string.base': 'Sales representative name must be a string',
      'string.min': 'Sales representative name must be at least 2 characters',
      'string.max': 'Sales representative name must not exceed 100 characters'
    })
});

// Payment processing validation schema
const paymentSchema = Joi.object({
  createdBy: Joi.string().min(2).max(100).required(),
  createdByName: Joi.string().min(2).max(100).required(),
  amount: Joi.number().positive().required(),
  paymentMethod: Joi.string().valid('mpesa', 'bank', 'cheque', 'cash').required(),
  phoneNumber: Joi.when('paymentMethod', {
    is: 'mpesa',
    then: phoneSchema.required(),
    otherwise: Joi.optional()
  }), 
  chequeNumber: Joi.when('paymentMethod', {
    is: 'cheque',
    then: Joi.string().required(),
    otherwise: Joi.optional()
  }),
  bankName: Joi.when('paymentMethod', {
    is: 'cheque',
    then: Joi.string().required(),
    otherwise: Joi.optional()
  }),
  chequeDate: Joi.when('paymentMethod', {
    is: 'cheque',
    then: Joi.date().required(),
    otherwise: Joi.optional()
  }),
  paymentDate: Joi.when('paymentMethod', {
    is: 'cheque',
    then: Joi.date().optional(),
    otherwise: Joi.date().required()
  }),
  transactionCode: Joi.when('paymentMethod', {
    is: 'mpesa',
    then: Joi.string().min(3).max(50).required(),
    otherwise: Joi.optional()
  }),
  bankDetails: Joi.when('paymentMethod', {
    is: 'bank',
    then: bankDetailSchema.required()
      .custom((value, helpers) => {
        const totalAmount = helpers.state.ancestors[0].amount;
        if (value.amount !== totalAmount) {
          return helpers.error('any.custom', {
            message: 'Bank details amount must equal the total payment amount'
          });
        }
        return value;
      }),
    otherwise: Joi.optional()
  })
});

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      console.error('Validation error details:', JSON.stringify(error.details, null, 2));
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errorMessage
      });
    }

    console.log('Validated request body:', JSON.stringify(value, null, 2));
    req.body = value;
    next();
  };
};

module.exports = {
  validate,
  schemas: {
    debt: debtSchema,
    payment: paymentSchema
  }
};