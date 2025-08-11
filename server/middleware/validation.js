const Joi = require('joi');

// Kenyan phone number validation
const phoneSchema = Joi.string()
  .pattern(/^\+254[17]\d{8}$/)
  .message('Phone number must be in format +254XXXXXXXXX');

// Debt creation validation schema
const debtSchema = Joi.object({
  storeOwner: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    phoneNumber: phoneSchema.required(),
    email: Joi.string().email().optional().allow('')
  }).required(),
  
  store: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    location: Joi.string().min(2).max(100).required()
  }).required(),
  
  amount: Joi.number().positive().max(10000000).required(), // Max 10M KES
  dateIssued: Joi.date().max('now').required(),
  dueDate: Joi.date().min(Joi.ref('dateIssued')).required(),
  paymentMethod: Joi.string().valid('mpesa', 'bank', 'cheque').required(),
  description: Joi.string().max(500).optional().allow(''),
  vehiclePlate: Joi.string().required().trim()
    .messages({
      'any.required': 'Vehicle plate number is required',
      'string.empty': 'Vehicle plate number cannot be empty'
    })
});

// Payment processing validation schema
const paymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  paymentMethod: Joi.string().valid('mpesa', 'bank', 'cheque','cash').required(),
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
    is: Joi.alternatives().try('cheque', 'bank'),
    then: Joi.string().required(),
    otherwise: Joi.optional()
  }),
  chequeDate: Joi.when('paymentMethod', {
    is: 'cheque',
    then: Joi.date().required(),
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