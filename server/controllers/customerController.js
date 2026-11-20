const customerService = require('../services/customerService');

async function getCustomerById(req, res, next) {
  try {
    const data = await customerService.getCustomerWithSalesHistory(
      req.params.customerId
    );
    return res.status(200).json(data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { getCustomerById };
