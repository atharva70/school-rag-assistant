import { Standard } from '../models/standard.model';
import { NotFoundError } from '../errors/AppError';

export class StandardService {
  static async getAllStandards() {
    const standards = await Standard.find().sort({ name: 1 });
    return standards;
  }

  static async getStandardById(id: string) {
    const standard = await Standard.findById(id);
    if (!standard) {
      throw new NotFoundError(`Standard with ID '${id}' not found`);
    }
    return standard;
  }
}
