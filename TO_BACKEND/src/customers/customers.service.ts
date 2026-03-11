import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { CustomerEntity } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Injectable()
export class CustomersService {

  constructor(
    @InjectRepository(CustomerEntity)
    private readonly repo: Repository<CustomerEntity>,
  ) {}

async findAll() {
  return this.repo.find({
    order: { createdAt: 'DESC' },
  });
}

  async findOne(id: string) {

    const customer = await this.repo.findOne({
      where: { id }
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;

  }

  async create(dto: CreateCustomerDto) {

    const customer = this.repo.create(dto);

    return this.repo.save(customer);

  }

  async remove(id: string) {

    const customer = await this.findOne(id);

    await this.repo.remove(customer);

    return { success: true };

  }

}
