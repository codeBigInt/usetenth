import type { AxiosInstance, AxiosRequestConfig } from "axios";
import axios from "axios";


export default class AxiosProvider {
  private instance: AxiosInstance;
  constructor(
    private readonly base_url: string,
  ) {
    this.instance = axios.create({
      baseURL: this.base_url
    })
  }

  public async get<TResponse>(url: string, config: AxiosRequestConfig): Promise<TResponse> {
    const response = await this.instance.get<TResponse>(url, config);

    return response.data;
  }


  public async post<TResponse, TData>(url: string, data: TData, config?: AxiosRequestConfig): Promise<TResponse> {
    const response = await this.instance.post<TResponse>(url, data, config);

    return response.data;
  }
}
